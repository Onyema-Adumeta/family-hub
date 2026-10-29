// Zero-typing scheduling: turn a flyer photo or a pasted school email into
// calendar events. The AI only proposes events; nothing is added until a
// family member reviews them and taps "Add" (POST /api/events/batch).
import { Router } from 'express';
import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { prisma } from '../db';
import { aiAllowed, AI_OFF_MESSAGE } from '../services/aiPrivacy';
import { addDays, startOfDay, ymd } from '../services/familyTime';
import { audit } from '../services/audit';
import { broadcast } from '../services/websocket';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || 'missing' });
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_TEXT = 20_000;

type Proposed = { title: string; date: string; time: string | null; endTime: string | null; location: string | null; notes: string | null; emoji: string; possibleDuplicate?: boolean };

function clean(raw: any): Proposed | null {
  if (!raw || typeof raw !== 'object') return null;
  const title = typeof raw.title === 'string' ? raw.title.trim().slice(0, 120) : '';
  const date = typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? raw.date : null;
  if (!title || !date || Number.isNaN(Date.parse(date + 'T12:00:00Z'))) return null;
  const hhmm = (v: any) => (typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : null);
  const text = (v: any, n: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : null);
  const emoji = typeof raw.emoji === 'string' && raw.emoji.length <= 8 ? raw.emoji : '📅';
  return { title, date, time: hhmm(raw.time), endTime: hhmm(raw.endTime), location: text(raw.location, 200), notes: text(raw.notes, 500), emoji };
}

/** POST /api/events/extract — body: { text?: string, image?: { mediaType, data(base64) } } */
export const extractHandler = [
  // Photos are bigger than the API's normal 50 kB request limit.
  express.json({ limit: '8mb' }),
  authMiddleware,
  async (req: AuthRequest, res: express.Response) => {
    if (!(await aiAllowed(req.familyId!))) return res.status(403).json({ error: AI_OFF_MESSAGE });
    const { text, image } = req.body || {};
    const hasText = typeof text === 'string' && text.trim().length > 0;
    const hasImage = image && typeof image.data === 'string' && image.data.length > 0;
    if (!hasText && !hasImage) return res.status(400).json({ error: 'Add a photo or paste some text' });
    if (hasText && text.length > MAX_TEXT) return res.status(400).json({ error: 'That text is too long — paste just the part with the dates' });
    if (hasImage) {
      if (!IMAGE_TYPES.includes(image.mediaType)) return res.status(400).json({ error: 'Use a JPEG, PNG, WebP or GIF photo' });
      if (!/^[A-Za-z0-9+/=]+$/.test(image.data) || Math.floor(image.data.length * 3 / 4) > MAX_IMAGE_BYTES) return res.status(400).json({ error: 'That photo is too large (max 5 MB)' });
    }

    const today = ymd();
    const instructions = `Extract calendar events for a family calendar from the ${hasImage ? 'image' : 'text'} provided.
Today is ${today} (time zone America/Vancouver). If a date has no year, use the next occurrence on or after today.
Return ONLY a JSON array (no markdown). Each item: {"title": short title, "date": "YYYY-MM-DD", "time": "HH:MM" 24-hour or null, "endTime": "HH:MM" or null, "location": string or null, "notes": one short line or null, "emoji": one fitting emoji}.
Include each distinct dated event once (for a repeating schedule, list each date). Skip anything without a specific date. If there are no events, return [].`;
    const content: any[] = [];
    if (hasImage) content.push({ type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.data } });
    content.push({ type: 'text', text: hasText ? `${instructions}\n\n---\n${text}` : instructions });

    let proposed: Proposed[] = [];
    try {
      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        messages: [{ role: 'user', content }],
      });
      const block = response.content[0] as any;
      const raw = block?.type === 'text' ? block.text : '[]';
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
      proposed = (Array.isArray(parsed) ? parsed : []).map(clean).filter((x): x is Proposed => !!x).slice(0, 20);
    } catch (e) {
      console.error('event extract error', e);
      return res.status(502).json({ error: "Couldn't read that right now. Try again, or type the event in." });
    }

    // Flag events that look like ones already on the calendar.
    if (proposed.length) {
      const dates = [...new Set(proposed.map(p => p.date))];
      const existing = await prisma.event.findMany({
        where: { familyId: req.familyId, OR: dates.map(d => ({ date: { gte: startOfDay(d), lt: startOfDay(addDays(d, 1)) } })) },
        select: { title: true, date: true },
      });
      const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      for (const p of proposed) {
        p.possibleDuplicate = existing.some(e => ymd(e.date) === p.date && (norm(e.title).includes(norm(p.title)) || norm(p.title).includes(norm(e.title))));
      }
    }
    res.json({ events: proposed });
  },
];

const router = Router();

// POST /api/events/batch — add the reviewed events in one go (max 20)
router.post('/batch', async (req: AuthRequest, res) => {
  const list = req.body?.events;
  if (!Array.isArray(list) || !list.length || list.length > 20) return res.status(400).json({ error: 'Choose between 1 and 20 events' });
  const items = list.map(clean);
  if (items.some(x => !x)) return res.status(400).json({ error: 'Each event needs a title and a date' });
  try {
    const created = await prisma.$transaction(items.map(e => prisma.event.create({
      data: {
        familyId: req.familyId!, title: e!.title, emoji: e!.emoji, date: new Date(e!.date + 'T12:00:00'),
        time: e!.time, notes: [e!.endTime ? `Until ${e!.endTime}` : null, e!.location, e!.notes].filter(Boolean).join(' · ') || null,
        source: 'import',
      } as any,
    })));
    await audit(req, 'event.imported', `added ${created.length} event${created.length > 1 ? 's' : ''} from a photo or message`, { type: 'event' });
    broadcast(req.familyId!, { type: 'events:synced' });
    res.json({ created: created.length, events: created });
  } catch (e) { console.error('batch events', e); res.status(500).json({ error: 'Could not add the events' }); }
});

export default router;
