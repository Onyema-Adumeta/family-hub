import { Router } from 'express';
import { AuthRequest } from '../middleware/auth';
import { broadcast } from '../services/websocket';
import { google } from 'googleapis';
const router = Router();
import { prisma } from '../db';

async function getCalendarClient(familyId: string) {
  const family = await (prisma.family.findUnique as any)({ where: { id: familyId } });
  const tokens = family?.googleTokens;
  if (!tokens) return null;
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  auth.setCredentials(JSON.parse(tokens));
  return google.calendar({ version: 'v3', auth });
}

// GET /api/events
router.get('/', async (req: AuthRequest, res) => {
  try {
    const events = await prisma.event.findMany({
      where: { familyId: req.familyId },
      include: { assignedTo: true },
      orderBy: { date: 'asc' },
    });
    res.json(events);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/events/google/auth — get OAuth URL
router.get('/google/auth', async (req: AuthRequest, res) => {
  try {
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    const url = auth.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['https://www.googleapis.com/auth/calendar'],
      state: req.familyId!,
    });
    res.json({ url });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/events/google/callback — OAuth callback
router.get('/google/callback', async (req: any, res) => {
  const { code, state: familyId } = req.query as { code: string; state: string };
  try {
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    console.log('OAuth callback hit. code present:', !!code, 'familyId:', familyId);
    console.log('Using redirect_uri:', process.env.GOOGLE_REDIRECT_URI);
    const { tokens } = await auth.getToken(code);
    await (prisma.family.update as any)({
      where: { id: familyId },
      data: { googleTokens: JSON.stringify(tokens) },
    });
    res.redirect((process.env.FRONTEND_URL || 'http://localhost:5173') + '/schedule?connected=1');
  } catch (e: any) {
    const detail = e?.response?.data || e?.message || 'unknown';
    console.error('OAuth callback error:', JSON.stringify(detail));
    res.status(500).json({ error: 'oauth_failed', detail });
  }
});

// GET /api/events/sync — pull events from Google Calendar
router.get('/sync', async (req: AuthRequest, res) => {
  try {
    const cal = await getCalendarClient(req.familyId!);
    if (!cal) return res.status(400).json({ error: 'Google Calendar not connected' });

    const now = new Date();
    const threeMonths = new Date(now.getFullYear(), now.getMonth() + 3, now.getDate());

    const response = await cal.events.list({
      calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
      timeMin: now.toISOString(),
      timeMax: threeMonths.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 100,
    });

    const googleEvents = response.data.items || [];
    let imported = 0;

    for (const gEvent of googleEvents) {
      if (!gEvent.id || !gEvent.summary) continue;
      const startDate = gEvent.start?.date || gEvent.start?.dateTime?.slice(0, 10);
      if (!startDate) continue;

      const existing = await prisma.event.findFirst({
        where: { familyId: req.familyId!, googleEventId: gEvent.id },
      });
      if (existing) continue;

      await prisma.event.create({
        data: {
          familyId:     req.familyId!,
          title:        gEvent.summary,
          emoji:        '📅',
          date:         new Date(startDate + 'T12:00:00'),
          time:         gEvent.start?.dateTime ? gEvent.start.dateTime.slice(11, 16) : undefined,
          color:        '#4285F4',
          notes:        gEvent.description || undefined,
          googleEventId: gEvent.id,
          source:       'google',
        } as any,
      });
      imported++;
    }

    broadcast(req.familyId!, { type: 'events:synced' });
    res.json({ imported, total: googleEvents.length });
  } catch (e: any) {
    console.error('Google Calendar sync error:', e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/events — create and optionally push to Google Calendar
router.post('/', async (req: AuthRequest, res) => {
  try {
    const event = await prisma.event.create({
      data: {
        familyId: req.familyId!,
        ...req.body,
        date:   new Date(req.body.date + 'T12:00:00'),
        source: 'app',
      } as any,
      include: { assignedTo: true },
    });

    // Push to Google Calendar if connected
    try {
      const cal = await getCalendarClient(req.familyId!);
      if (cal) {
        const gEvent = await cal.events.insert({
          calendarId: 'primary',
          requestBody: {
            summary:     req.body.title,
            description: req.body.notes || undefined,
            start: req.body.time
              ? { dateTime: req.body.date + 'T' + req.body.time + ':00', timeZone: 'America/Vancouver' }
              : { date: req.body.date },
            end: req.body.time
              ? { dateTime: req.body.date + 'T' + req.body.time + ':00', timeZone: 'America/Vancouver' }
              : { date: req.body.date },
          },
        });
        await prisma.event.update({
          where: { id: event.id },
          data:  { googleEventId: gEvent.data.id! } as any,
        });
      }
    } catch (calErr) {
      console.error('Failed to push to Google Calendar:', calErr);
    }

    broadcast(req.familyId!, { type: 'event:created', event });
    res.json(event);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// DELETE /api/events/:id — delete from app and Google Calendar
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.id } });

    if ((event as any)?.googleEventId) {
      try {
        const cal = await getCalendarClient(req.familyId!);
        if (cal) {
          await cal.events.delete({
            calendarId: 'primary',
            eventId:    (event as any).googleEventId,
          });
        }
      } catch (calErr) {
        console.error('Failed to delete from Google Calendar:', calErr);
      }
    }

    await prisma.event.delete({ where: { id: req.params.id } });
    broadcast(req.familyId!, { type: 'event:deleted', id: req.params.id });
    res.json({ ok: true });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

export default router;