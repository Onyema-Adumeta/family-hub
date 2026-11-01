// "Send feedback" from inside the app, and beta applications from the landing page.
import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { z } from 'zod';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { prisma } from '../db';
import { sendMail } from '../services/mailer';

const many = (n: number) => n * Number(process.env.RATE_LIMIT_MULTIPLIER || 1);
const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Emails the Kinroost team, if SUPPORT_EMAIL is set. Never blocks or throws. */
function tellTeam(subject: string, text: string) {
  const to = process.env.SUPPORT_EMAIL;
  if (to) void sendMail({ to, subject, text });
}

// ── In-app feedback (signed in) ────────────────────────────────────────────────
export const feedbackRoutes = Router();

const FeedbackSchema = z.object({
  kind: z.enum(['bug', 'idea', 'other']).default('other'),
  message: z.string().trim().min(3, 'Tell us a little more').max(2000, 'Please keep it under 2000 characters'),
  page: z.string().max(120).optional(),
  device: z.string().max(60).optional(),
});

const feedbackLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: () => many(20),
  keyGenerator: (req: AuthRequest) => `fb:${req.memberId || ipKeyGenerator(req.ip || '')}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Thanks! That is a lot of feedback for one hour — please try again later.' },
});

// POST /api/feedback
feedbackRoutes.post('/', authMiddleware, feedbackLimiter, async (req: AuthRequest, res) => {
  const parsed = FeedbackSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });
  const { kind, message, page, device } = parsed.data;
  try {
    const me = await prisma.member.findUnique({ where: { id: req.memberId }, select: { name: true, role: true, family: { select: { name: true } } } });
    const saved = await prisma.feedback.create({
      data: { familyId: req.familyId!, memberId: req.memberId, role: me?.role || req.role || 'child', kind, message, page, device },
      select: { id: true, createdAt: true },
    });
    tellTeam(
      `Kinroost feedback (${kind}) from ${me?.family?.name || 'a family'}`,
      `${message}\n\n— ${me?.name || 'someone'} (${me?.role || '?'}), family "${me?.family?.name || '?'}"\nScreen: ${page || '?'} · Device: ${device || '?'}\nFeedback id: ${saved.id}`,
    );
    res.json({ ok: true, id: saved.id });
  } catch (e) {
    console.error('[feedback] could not save', e);
    res.status(500).json({ error: 'Could not send feedback. Please try again.' });
  }
});

// ── Beta applications (public, from the landing page) ──────────────────────────
export const betaRoutes = Router();

const BetaSchema = z.object({
  parentName: z.string().transform(oneLine).pipe(z.string().min(1, 'Please add your name').max(80)),
  email: z.string().trim().toLowerCase().email('Please enter a valid email address').max(200),
  country: z.enum(['Canada', 'United States', 'Other']),
  region: z.string().transform(oneLine).pipe(z.string().min(1, 'Please add your province or state').max(60)),
  kids: z.string().transform(oneLine).pipe(z.string().min(1, 'Please add your kids’ ages').max(80)),
  devices: z.string().transform(oneLine).pipe(z.string().min(1, 'Which devices will your family use?').max(80)),
  why: z.string().trim().max(1000).optional(),
  heardFrom: z.string().transform(oneLine).pipe(z.string().max(200)).optional(),
  // Honeypot: a hidden field people never fill in. Bots often do.
  website: z.string().max(0).optional(),
});

const betaLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: () => many(5),
  keyGenerator: (req) => `beta:${ipKeyGenerator(req.ip || '')}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many applications from this connection. Please try again later.' },
});

// POST /api/beta-applications
betaRoutes.post('/', betaLimiter, async (req, res) => {
  if (typeof req.body?.website === 'string' && req.body.website.length) return res.json({ ok: true }); // bot: pretend it worked
  const parsed = BetaSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });
  const d = parsed.data;
  const a = { parentName: d.parentName!, email: d.email!, country: d.country!, region: d.region!, kids: d.kids!, devices: d.devices!, why: d.why || null, heardFrom: d.heardFrom || null };
  try {
    // Applying twice within 30 days just updates the first application.
    const recent = await prisma.betaApplication.findFirst({
      where: { email: a.email, createdAt: { gte: new Date(Date.now() - 30 * 24 * 3600 * 1000) } },
      select: { id: true },
    });
    if (recent) {
      await prisma.betaApplication.update({ where: { id: recent.id }, data: a });
      return res.json({ ok: true });
    }
    await prisma.betaApplication.create({ data: a });
    tellTeam(
      `New Kinroost beta application: ${a.parentName} (${a.region}, ${a.country})`,
      `Name: ${a.parentName}\nEmail: ${a.email}\nWhere: ${a.region}, ${a.country}\nKids' ages: ${a.kids}\nDevices: ${a.devices}\nHeard about us: ${a.heardFrom || '-'}\n\nWhy:\n${a.why || '-'}`,
    );
    void sendMail({
      to: a.email,
      subject: 'Thanks for applying to the Kinroost beta',
      text: `Hi ${a.parentName},\n\nThanks for applying to try Kinroost with your family. We're inviting a small group of families at a time, and we'll email you when there's a spot.\n\nIf you didn't apply, you can ignore this email.\n\n— The Kinroost team`,
    });
    res.json({ ok: true });
  } catch (e) {
    console.error('[beta] could not save application', e);
    res.status(500).json({ error: 'Could not send your application. Please try again.' });
  }
});
