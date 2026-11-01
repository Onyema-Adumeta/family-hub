import { Router } from 'express';
import { AuthRequest } from '../middleware/auth';
import { broadcast } from '../services/websocket';
import { google } from 'googleapis';
import jwt from 'jsonwebtoken';
const router = Router();
import { prisma } from '../db';
import { memberInFamily, requireParent } from '../lib/guards';

const EVENT_FIELDS = ['title', 'emoji', 'time', 'color', 'notes', 'assignedToId'] as const;

import { decryptSecret, encryptSecret, encryptionConfigured, isEncrypted } from '../services/secretBox';

// Google tokens are stored encrypted (AES-256-GCM). Tokens saved before
// encryption existed are read as-is and re-saved encrypted on first use.
async function getCalendarClient(familyId: string) {
  const family = await prisma.family.findUnique({ where: { id: familyId }, select: { googleTokens: true } });
  const stored = family?.googleTokens;
  if (!stored) return null;
  const tokens = JSON.parse(decryptSecret(stored));
  const save = async (t: any) => {
    if (!encryptionConfigured()) return;
    await prisma.family.update({ where: { id: familyId }, data: { googleTokens: encryptSecret(JSON.stringify(t)) } });
  };
  if (!isEncrypted(stored)) await save(tokens).catch(e => console.error('Could not encrypt legacy Google tokens', e));
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  auth.setCredentials(tokens);
  // Keep refreshed access tokens (Google sends these when the old one expires).
  auth.on('tokens', t => { save({ ...tokens, ...t }).catch(e => console.error('Could not save refreshed Google tokens', e)); });
  return google.calendar({ version: 'v3', auth });
}

// GET /api/events
router.get('/', async (req: AuthRequest, res) => {
  try {
    const events = await prisma.event.findMany({
      where: { familyId: req.familyId },
      include: { assignedTo: { select: { id: true, name: true, emoji: true, color: true } } },
      orderBy: { date: 'asc' },
    });
    res.json(events);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/events/google/auth — get OAuth URL
router.get('/google/auth', async (req: AuthRequest, res) => {
  if (!requireParent(req, res)) return;
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
      state: jwt.sign({ familyId: req.familyId!, purpose: 'google-calendar-oauth' }, process.env.JWT_SECRET!, { expiresIn: '10m', algorithm: 'HS256' }),
    });
    res.json({ url });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
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
    res.status(500).json({ error: 'Google Calendar sync failed' });
  }
});

import { googleBody, ymdOf } from '../services/googleCalendar';

// POST /api/events — create and optionally push to Google Calendar
router.post('/', async (req: AuthRequest, res) => {
  try {
    const body = req.body || {};
    if (typeof body.title !== 'string' || !body.title.trim()) return res.status(400).json({ error: 'title is required' });
    if (typeof body.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
    if (body.assignedToId && !(await memberInFamily(body.assignedToId, req.familyId!))) return res.status(400).json({ error: 'Invalid member' });
    const fields: any = {};
    for (const k of EVENT_FIELDS) if (body[k] !== undefined) fields[k] = body[k] === '' && k === 'assignedToId' ? null : body[k];
    const event = await prisma.event.create({
      data: {
        ...fields,
        familyId: req.familyId!,
        date:   new Date(body.date + 'T12:00:00'),
        source: 'app',
      } as any,
      include: { assignedTo: { select: { id: true, name: true, emoji: true, color: true } } },
    });

    // Push to Google Calendar if connected
    try {
      const cal = await getCalendarClient(req.familyId!);
      if (cal) {
        const gEvent = await cal.events.insert({
          calendarId: 'primary',
          requestBody: googleBody({ title: body.title.trim(), date: body.date, time: body.time || null, notes: body.notes || null }),
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

// PATCH /api/events/:id — edit an event (and its Google Calendar copy, if it has one)
router.patch('/:id', async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.event.findFirst({ where: { id: req.params.id, familyId: req.familyId } });
    if (!existing) return res.status(404).json({ error: 'Event not found' });
    const b = req.body || {};
    const data: any = {};
    if (b.title !== undefined) {
      if (typeof b.title !== 'string' || !b.title.trim() || b.title.length > 200) return res.status(400).json({ error: 'Give the event a title' });
      data.title = b.title.trim();
    }
    if (b.date !== undefined) {
      if (typeof b.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(b.date) || isNaN(Date.parse(b.date))) return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
      data.date = new Date(b.date + 'T12:00:00');
    }
    if (b.time !== undefined) {
      if (b.time === null || b.time === '') data.time = null;
      else if (typeof b.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(b.time)) data.time = b.time;
      else return res.status(400).json({ error: 'time must be HH:MM' });
    }
    if (b.assignedToId !== undefined) {
      if (b.assignedToId === null || b.assignedToId === '') data.assignedToId = null;
      else if (typeof b.assignedToId === 'string' && (await memberInFamily(b.assignedToId, req.familyId!))) data.assignedToId = b.assignedToId;
      else return res.status(400).json({ error: 'Invalid member' });
    }
    for (const [k, max] of [['emoji', 16], ['color', 20], ['notes', 2000]] as const) {
      if (b[k] === undefined) continue;
      if (b[k] === null || b[k] === '') { if (k !== 'emoji') data[k] = null; continue; }
      if (typeof b[k] !== 'string' || b[k].length > max) return res.status(400).json({ error: `Invalid ${k}` });
      data[k] = b[k];
    }
    if (!Object.keys(data).length) return res.status(400).json({ error: 'Nothing to change' });

    const event = await prisma.event.update({
      where: { id: existing.id },
      data,
      include: { assignedTo: { select: { id: true, name: true, emoji: true, color: true } } },
    });

    // Keep the Google Calendar copy in step. The edit is saved either way.
    let googleUpdated: boolean | null = null;
    if (existing.googleEventId) {
      try {
        const cal = await getCalendarClient(req.familyId!);
        if (cal) {
          await cal.events.patch({
            calendarId: 'primary',
            eventId: existing.googleEventId,
            requestBody: googleBody({ title: event.title, date: ymdOf(event.date), time: event.time, notes: event.notes }),
          });
          googleUpdated = true;
        }
      } catch (calErr: any) {
        console.error('Failed to update Google Calendar event:', calErr?.message || calErr);
        googleUpdated = false;
      }
    }

    broadcast(req.familyId!, { type: 'event:updated', event });
    res.json({ ...event, googleUpdated });
  } catch (e) {
    console.error('event update failed', e);
    res.status(500).json({ error: 'Could not save the event' });
  }
});

// DELETE /api/events/:id — delete from app and Google Calendar
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const event = await prisma.event.findFirst({ where: { id: req.params.id, familyId: req.familyId } });
    if (!event) return res.status(404).json({ error: 'Event not found' });

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

    await prisma.event.delete({ where: { id: event.id } });
    broadcast(req.familyId!, { type: 'event:deleted', id: req.params.id });
    res.json({ ok: true });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

export default router;