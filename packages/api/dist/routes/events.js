"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const websocket_1 = require("../services/websocket");
const googleapis_1 = require("googleapis");
const router = (0, express_1.Router)();
const db_1 = require("../db");
async function getCalendarClient(familyId) {
    const family = await db_1.prisma.family.findUnique({ where: { id: familyId } });
    const tokens = family?.googleTokens;
    if (!tokens)
        return null;
    const auth = new googleapis_1.google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);
    auth.setCredentials(JSON.parse(tokens));
    return googleapis_1.google.calendar({ version: 'v3', auth });
}
// GET /api/events
router.get('/', async (req, res) => {
    try {
        const events = await db_1.prisma.event.findMany({
            where: { familyId: req.familyId },
            include: { assignedTo: true },
            orderBy: { date: 'asc' },
        });
        res.json(events);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// GET /api/events/google/auth — get OAuth URL
router.get('/google/auth', async (req, res) => {
    try {
        const auth = new googleapis_1.google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);
        const url = auth.generateAuthUrl({
            access_type: 'offline',
            prompt: 'consent',
            scope: ['https://www.googleapis.com/auth/calendar'],
            state: req.familyId,
        });
        res.json({ url });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// GET /api/events/google/callback — OAuth callback
router.get('/google/callback', async (req, res) => {
    const { code, state: familyId } = req.query;
    try {
        const auth = new googleapis_1.google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);
        const { tokens } = await auth.getToken(code);
        await db_1.prisma.family.update({
            where: { id: familyId },
            data: { googleTokens: JSON.stringify(tokens) },
        });
        res.redirect((process.env.FRONTEND_URL || 'http://localhost:5173') + '/schedule?connected=1');
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// GET /api/events/sync — pull events from Google Calendar
router.get('/sync', async (req, res) => {
    try {
        const cal = await getCalendarClient(req.familyId);
        if (!cal)
            return res.status(400).json({ error: 'Google Calendar not connected' });
        const now = new Date();
        const threeMonths = new Date(now.getFullYear(), now.getMonth() + 3, now.getDate());
        const response = await cal.events.list({
            calendarId: 'primary',
            timeMin: now.toISOString(),
            timeMax: threeMonths.toISOString(),
            singleEvents: true,
            orderBy: 'startTime',
            maxResults: 100,
        });
        const googleEvents = response.data.items || [];
        let imported = 0;
        for (const gEvent of googleEvents) {
            if (!gEvent.id || !gEvent.summary)
                continue;
            const startDate = gEvent.start?.date || gEvent.start?.dateTime?.slice(0, 10);
            if (!startDate)
                continue;
            const existing = await db_1.prisma.event.findFirst({
                where: { familyId: req.familyId, googleEventId: gEvent.id },
            });
            if (existing)
                continue;
            await db_1.prisma.event.create({
                data: {
                    familyId: req.familyId,
                    title: gEvent.summary,
                    emoji: '📅',
                    date: new Date(startDate + 'T12:00:00'),
                    time: gEvent.start?.dateTime ? gEvent.start.dateTime.slice(11, 16) : undefined,
                    color: '#4285F4',
                    notes: gEvent.description || undefined,
                    googleEventId: gEvent.id,
                    source: 'google',
                },
            });
            imported++;
        }
        (0, websocket_1.broadcast)(req.familyId, { type: 'events:synced' });
        res.json({ imported, total: googleEvents.length });
    }
    catch (e) {
        console.error('Google Calendar sync error:', e);
        res.status(500).json({ error: e.message });
    }
});
// POST /api/events — create and optionally push to Google Calendar
router.post('/', async (req, res) => {
    try {
        const event = await db_1.prisma.event.create({
            data: {
                familyId: req.familyId,
                ...req.body,
                date: new Date(req.body.date + 'T12:00:00'),
                source: 'app',
            },
            include: { assignedTo: true },
        });
        // Push to Google Calendar if connected
        try {
            const cal = await getCalendarClient(req.familyId);
            if (cal) {
                const gEvent = await cal.events.insert({
                    calendarId: 'primary',
                    requestBody: {
                        summary: req.body.title,
                        description: req.body.notes || undefined,
                        start: req.body.time
                            ? { dateTime: req.body.date + 'T' + req.body.time + ':00', timeZone: 'America/Vancouver' }
                            : { date: req.body.date },
                        end: req.body.time
                            ? { dateTime: req.body.date + 'T' + req.body.time + ':00', timeZone: 'America/Vancouver' }
                            : { date: req.body.date },
                    },
                });
                await db_1.prisma.event.update({
                    where: { id: event.id },
                    data: { googleEventId: gEvent.data.id },
                });
            }
        }
        catch (calErr) {
            console.error('Failed to push to Google Calendar:', calErr);
        }
        (0, websocket_1.broadcast)(req.familyId, { type: 'event:created', event });
        res.json(event);
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
// DELETE /api/events/:id — delete from app and Google Calendar
router.delete('/:id', async (req, res) => {
    try {
        const event = await db_1.prisma.event.findUnique({ where: { id: req.params.id } });
        if (event?.googleEventId) {
            try {
                const cal = await getCalendarClient(req.familyId);
                if (cal) {
                    await cal.events.delete({
                        calendarId: 'primary',
                        eventId: event.googleEventId,
                    });
                }
            }
            catch (calErr) {
                console.error('Failed to delete from Google Calendar:', calErr);
            }
        }
        await db_1.prisma.event.delete({ where: { id: req.params.id } });
        (0, websocket_1.broadcast)(req.familyId, { type: 'event:deleted', id: req.params.id });
        res.json({ ok: true });
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=events.js.map