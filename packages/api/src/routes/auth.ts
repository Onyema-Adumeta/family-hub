import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { PUBLIC_FAMILY_SELECT, SELF_MEMBER_SELECT, requireParent } from '../lib/guards';
import { audit } from '../services/audit';
import { consumeToken, peekToken, sendResetEmail, sendVerificationEmail } from '../services/authTokens';
import { TERMS_VERSION } from '../lib/legal';

const router = Router();

// ── Rate limiters ─────────────────────────────────────────────────────────────
// Tells people how long to wait, and whether it was this network or this account.
const minutesLeft = (req: any) => {
  const reset: Date | undefined = req.rateLimit?.resetTime;
  return reset ? Math.max(1, Math.ceil((reset.getTime() - Date.now()) / 60000)) : 15;
};

// Per network: only FAILED attempts count (wrong password, bad link, bad code),
// so a household signing everyone in on one home Wi-Fi never hits it. It
// stops one network from guessing across many accounts.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30 * Number(process.env.RATE_LIMIT_MULTIPLIER || 1),
  skipSuccessfulRequests: true,
  handler: (req, res) => {
    const m = minutesLeft(req);
    res.status(429).json({ error: `Too many failed attempts from this network. Please wait ${m} minute${m > 1 ? 's' : ''} and try again.`, retryAfterMinutes: m });
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Per-account limit: 10 failed sign-ins for the same family code + name in
// 15 minutes, no matter which network they come from. Successful sign-ins
// don't count. (The per-IP limit above still applies too.)
const accountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    if (req.body?.email) return `email:${String(req.body.email).trim().toLowerCase()}`;
    const code = String(req.body?.familyCode || '').trim().toUpperCase().replace(/\s+/g, '');
    const name = String(req.body?.name || '').trim().toLowerCase();
    return `acct:${code}:${name}`;
  },
  handler: (req, res) => {
    const m = minutesLeft(req);
    res.status(429).json({ error: `Too many wrong passwords for this account. Please wait ${m} minute${m > 1 ? 's' : ''}, or ask a parent to set a new password.`, retryAfterMinutes: m });
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false },
});

// Password-reset emails: at most 3 per email address per hour.
const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  keyGenerator: (req) => `reset:${String(req.body?.email || '').trim().toLowerCase()}`,
  // Same reply as success, so this can't be used to discover which emails have accounts.
  handler: (_req, res) => res.json({ ok: true }),
  validate: { keyGeneratorIpFallback: false },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 50 * Number(process.env.RATE_LIMIT_MULTIPLIER || 1),
  message: { error: 'Too many accounts created, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Zod schemas ───────────────────────────────────────────────────────────────
// "password" can be a 4+ digit PIN for kids or a longer password for parents.
export const PasswordSchema = z.string()
  .min(4, 'Password or PIN must be at least 4 characters')
  .max(72, 'Password is too long');

// Parents can see and delete the whole family's data, so they need more than a PIN.
// Existing shorter parent passwords keep working; the app asks them to change it.
export const PARENT_PASSWORD_MIN = 8;
export const ParentPasswordSchema = z.string()
  .min(PARENT_PASSWORD_MIN, `Parent passwords need at least ${PARENT_PASSWORD_MIN} characters`)
  .max(72, 'Password is too long');
/** Checks a new password for someone with this role. Returns an error message, or null if fine. */
export function newPasswordProblem(password: unknown, role: string): string | null {
  const r = (role === 'parent' ? ParentPasswordSchema : PasswordSchema).safeParse(password);
  return r.success ? null : r.error.errors[0].message;
}

const RegisterSchema = z.object({
  familyName: z.string().min(1).max(50).trim(),
  name:       z.string().min(1).max(50).trim(),
  password:   ParentPasswordSchema,
  emoji:      z.string().max(10).optional(),
  color:      z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  // The parent's email: used to sign in and to reset a forgotten password.
  email:      z.string().trim().toLowerCase().pipe(z.string().email('Enter a valid email address').max(200)),
  // The parent must accept the Terms and Privacy Policy and consent to the
  // collection of their children's information as described there.
  acceptTerms:      z.literal(true, { errorMap: () => ({ message: 'Please accept the Terms of Service and Privacy Policy' }) }),
  childDataConsent: z.literal(true, { errorMap: () => ({ message: 'Please confirm you are the parent or guardian and consent for your children' }) }),
});

// Sign in with family code + name + password (everyone), or email + password
// (anyone with a confirmed email — usually parents).
const CodeLoginSchema = z.object({
  familyCode: z.string().min(1).max(20).trim().toUpperCase().transform(s => s.replace(/\s+/g, '')),
  name:       z.string().min(1).max(50).trim(),
  password:   PasswordSchema,
});
const EmailLoginSchema = z.object({
  email:    z.string().trim().toLowerCase().pipe(z.string().email().max(200)),
  password: PasswordSchema,
});

// Anyone joining with the invite code joins as a child.
// A parent promotes another adult from Settings (PATCH /api/members/:id/role).
const JoinSchema = z.object({
  inviteCode: z.string().min(1).max(20).trim().toUpperCase(),
  name:       z.string().min(1).max(50).trim(),
  password:   PasswordSchema,
  emoji:      z.string().max(10).optional(),
  color:      z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

// ── Helpers ───────────────────────────────────────────────────────────────────
// No 0/O/1/I to keep codes easy to read aloud. 31^6 ≈ 887 million combinations.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function makeInviteCode() {
  const bytes = crypto.randomBytes(6);
  let out = '';
  for (const b of bytes) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return 'FAM-' + out;
}
async function uniqueInviteCode() {
  for (let i = 0; i < 5; i++) {
    const code = makeInviteCode();
    if (!(await prisma.family.findUnique({ where: { inviteCode: code } }))) return code;
  }
  throw new Error('Could not generate an invite code');
}
// Sign-ins last 14 days and are renewed while the app is in use (POST /auth/refresh).
// "tv" is the member's tokenVersion: bumping it signs that member out everywhere.
export const TOKEN_LIFETIME = '14d';
export function makeToken(memberId: string, familyId: string, role: string, tokenVersion: number) {
  return jwt.sign({ memberId, familyId, role, tv: tokenVersion }, process.env.JWT_SECRET!, { expiresIn: TOKEN_LIFETIME, algorithm: 'HS256' });
}
export const hashPassword = (pw: string) => bcrypt.hash(pw, 10);

// Same error for unknown family, unknown name and wrong password, so the
// login form can't be used to discover who is in a family.
const LOGIN_FAILED = 'Family code, name or password is incorrect';
// A fixed hash so a missing member costs the same time as a wrong password.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

// ── Register ──────────────────────────────────────────────────────────────────
router.post('/register', registerLimiter, async (req, res) => {
  try {
    const parsed = RegisterSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });
    const { familyName, name, password, emoji, color, email } = parsed.data;
    const now = new Date();
    const family = await prisma.family.create({
      data: {
        name: familyName,
        inviteCode: await uniqueInviteCode(),
        termsAcceptedAt: now,
        termsVersion: TERMS_VERSION,
        childConsentAt: now,
        members: {
          create: {
            name, emoji: emoji || '👨', color: color || '#6366F1',
            role: 'parent', password: await hashPassword(password), email, stars: 0,
          },
        },
      },
      select: { ...PUBLIC_FAMILY_SELECT, members: { select: SELF_MEMBER_SELECT } },
    });
    const { members, ...familyOut } = family;
    const member = members[0];
    await prisma.family.update({ where: { id: family.id }, data: { termsAcceptedById: member.id } });
    await audit({ familyId: family.id, memberId: member.id } as any, 'family.created', `created the family "${familyName}" and accepted the terms and privacy policy (${TERMS_VERSION})`, { type: 'family', id: family.id });
    const emailSent = await sendVerificationEmail({ id: member.id, name: member.name, email });
    res.json({ token: makeToken(member.id, family.id, member.role, 0), member, family: familyOut, emailSent });
  } catch (e) {
    console.error('register error', e);
    res.status(500).json({ error: 'Could not create family' });
  }
});

// ── Login ─────────────────────────────────────────────────────────────────────
router.post('/login', authLimiter, accountLimiter, async (req, res) => {
  try {
    if (req.body?.email !== undefined) return emailLogin(req, res);
    const parsed = CodeLoginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });
    const { familyCode, name, password } = parsed.data;

    const family = await prisma.family.findUnique({ where: { inviteCode: familyCode }, select: PUBLIC_FAMILY_SELECT });
    const found = family
      ? await prisma.member.findFirst({
          where: { familyId: family.id, name: { equals: name, mode: 'insensitive' } },
          select: { id: true, password: true, tokenVersion: true, role: true },
        })
      : null;

    let passwordCreated = false;
    if (!family || !found) {
      await bcrypt.compare(password, DUMMY_HASH);
      return res.status(401).json({ error: LOGIN_FAILED });
    }

    if (!found.password) {
      const problem = newPasswordProblem(password, found.role);
      if (problem) return res.status(400).json({ error: problem });
      // Accounts created before passwords existed have an empty password.
      // The first successful sign-in sets it; after that it is required.
      // updateMany with password:'' makes this a one-time claim even under races.
      const claimed = await prisma.member.updateMany({
        where: { id: found.id, password: '' },
        data: { password: await hashPassword(password) },
      });
      if (claimed.count !== 1) return res.status(401).json({ error: LOGIN_FAILED });
      passwordCreated = true;
    } else if (!(await bcrypt.compare(password, found.password))) {
      return res.status(401).json({ error: LOGIN_FAILED });
    }

    const member = await prisma.member.findUniqueOrThrow({ where: { id: found.id }, select: SELF_MEMBER_SELECT });
    res.json({ token: makeToken(member.id, family.id, member.role, found.tokenVersion), member, family, passwordCreated, ...weakFlag(member.role, password) });
  } catch (e) {
    console.error('login error', e);
    res.status(500).json({ error: 'Could not sign in' });
  }
});

async function emailLogin(req: any, res: any) {
  const parsed = EmailLoginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });
  const { email, password } = parsed.data;
  // Only confirmed email addresses can be used to sign in.
  const candidates = await prisma.member.findMany({
    where: { email: { equals: email, mode: 'insensitive' }, emailVerifiedAt: { not: null }, NOT: { password: '' } },
    select: { id: true, familyId: true, password: true, tokenVersion: true },
  });
  const matches = [];
  for (const c of candidates) if (await bcrypt.compare(password, c.password)) matches.push(c);
  if (!candidates.length) await bcrypt.compare(password, DUMMY_HASH);
  if (matches.length === 0) return res.status(401).json({ error: 'Email or password is incorrect' });
  if (matches.length > 1) return res.status(409).json({ error: 'This email is used by more than one account. Sign in with your family code and name instead.' });
  const found = matches[0];
  const member = await prisma.member.findUniqueOrThrow({ where: { id: found.id }, select: SELF_MEMBER_SELECT });
  const family = await prisma.family.findUniqueOrThrow({ where: { id: found.familyId }, select: PUBLIC_FAMILY_SELECT });
  res.json({ token: makeToken(member.id, family.id, member.role, found.tokenVersion), member, family, passwordCreated: false, ...weakFlag(member.role, password) });
}

/** Parents with a password shorter than the current minimum are asked to change it. */
const weakFlag = (role: string, password: string) =>
  role === 'parent' && password.length < PARENT_PASSWORD_MIN ? { passwordTooShort: true } : {};

// ── Email verification ────────────────────────────────────────────────────────
router.post('/verify-email', authLimiter, async (req, res) => {
  try {
    const row = await consumeToken(req.body?.token, 'verify_email');
    if (!row) return res.status(400).json({ error: 'This link is invalid or has expired. Sign in and ask for a new one in Settings.' });
    const member = await prisma.member.findUnique({ where: { id: row.memberId }, select: { email: true } });
    // The address must not have changed since the link was sent.
    if (!member || !member.email || member.email.toLowerCase() !== (row.email || '').toLowerCase()) {
      return res.status(400).json({ error: 'This link is for an email address that is no longer on the account.' });
    }
    await prisma.member.update({ where: { id: row.memberId }, data: { emailVerifiedAt: new Date() } });
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Could not confirm email' }); }
});

router.post('/resend-verification', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const m = await prisma.member.findUnique({ where: { id: req.memberId }, select: { id: true, name: true, email: true, emailVerifiedAt: true } });
    if (!m?.email) return res.status(400).json({ error: 'Add an email address first' });
    if (m.emailVerifiedAt) return res.json({ ok: true, alreadyVerified: true });
    const sent = await sendVerificationEmail(m);
    if (!sent) return res.status(503).json({ error: 'Email is not available right now. Please try again later.' });
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Could not send email' }); }
});

// ── Forgot / reset password ───────────────────────────────────────────────────
// Always answers { ok: true } so nobody can find out which emails have accounts.
router.post('/forgot-password', authLimiter, resetLimiter, async (req, res) => {
  const parsed = z.string().trim().toLowerCase().pipe(z.string().email()).safeParse(req.body?.email);
  if (!parsed.success) return res.status(400).json({ error: 'Enter a valid email address' });
  try {
    const accounts = await prisma.member.findMany({
      where: { email: { equals: parsed.data, mode: 'insensitive' }, emailVerifiedAt: { not: null } },
      select: { id: true, name: true, family: { select: { name: true } } },
    });
    if (accounts.length) {
      await sendResetEmail(parsed.data, accounts.map(a => ({ id: a.id, name: a.name, familyName: a.family.name })));
    }
  } catch (e) { console.error('forgot-password error', e); }
  res.json({ ok: true });
});

router.post('/reset-password', authLimiter, async (req, res) => {
  const pw = PasswordSchema.safeParse(req.body?.password);
  if (!pw.success) return res.status(400).json({ error: pw.error.errors[0].message });
  try {
    // Check the new password against the account's rules before using up the link.
    const peek = await peekToken(req.body?.token, 'reset_password');
    if (!peek) return res.status(400).json({ error: 'This reset link is invalid, expired or already used. Ask for a new one.' });
    const who = await prisma.member.findUnique({ where: { id: peek.memberId }, select: { role: true } });
    const problem = newPasswordProblem(pw.data, who?.role || 'child');
    if (problem) return res.status(400).json({ error: problem });
    const row = await consumeToken(req.body?.token, 'reset_password');
    if (!row) return res.status(400).json({ error: 'This reset link is invalid, expired or already used. Ask for a new one.' });
    const member = await prisma.member.update({
      where: { id: row.memberId },
      // New password, and every existing sign-in on every device ends.
      data: { password: await hashPassword(pw.data), tokenVersion: { increment: 1 } },
      select: { id: true, familyId: true, name: true },
    });
    await prisma.authToken.deleteMany({ where: { memberId: member.id, purpose: 'reset_password', usedAt: null } });
    await audit({ familyId: member.familyId, memberId: member.id } as any, 'member.password_reset_by_email', 'reset their password using an emailed link', { type: 'member', id: member.id });
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Could not reset password' }); }
});

// ── Join ──────────────────────────────────────────────────────────────────────
router.post('/join', authLimiter, async (req, res) => {
  try {
    const parsed = JoinSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });
    const { inviteCode, name, password, emoji, color } = parsed.data;
    const family = await prisma.family.findUnique({ where: { inviteCode }, select: PUBLIC_FAMILY_SELECT });
    if (!family) return res.status(400).json({ error: 'Invalid invite code' });
    const consent = await prisma.family.findUnique({ where: { id: family.id }, select: { childConsentAt: true } });
    if (!consent?.childConsentAt) {
      return res.status(403).json({ error: 'A parent needs to accept the updated privacy policy in Kinroost before anyone new can join.' });
    }

    const existing = await prisma.member.findFirst({
      where: { familyId: family.id, name: { equals: name, mode: 'insensitive' } },
    });
    if (existing) return res.status(400).json({ error: 'That name is already taken in this family' });

    const member = await prisma.member.create({
      data: {
        familyId: family.id, name, emoji: emoji || '🙂',
        color: color || '#F472B6', role: 'child', password: await hashPassword(password), stars: 0,
      },
      select: SELF_MEMBER_SELECT,
    });
    await audit({ familyId: family.id, memberId: member.id } as any, 'member.joined', `joined the family`, { type: 'member', id: member.id });
    res.json({ token: makeToken(member.id, family.id, member.role, 0), member, family });
  } catch (e) {
    console.error('join error', e);
    res.status(500).json({ error: 'Could not join family' });
  }
});

// ── Me ────────────────────────────────────────────────────────────────────────
router.get('/me', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const member = await prisma.member.findUnique({ where: { id: req.memberId }, select: SELF_MEMBER_SELECT });
    const family = await prisma.family.findUnique({ where: { id: req.familyId }, select: PUBLIC_FAMILY_SELECT });
    res.json({ member, family });
  } catch {
    res.status(500).json({ error: 'Could not load account' });
  }
});

// ── Refresh: swap a valid sign-in for a fresh 14-day one ─────────────────────
router.post('/refresh', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const member = await prisma.member.findUniqueOrThrow({ where: { id: req.memberId }, select: { ...SELF_MEMBER_SELECT, tokenVersion: true } });
    const { tokenVersion, ...memberOut } = member;
    res.json({ token: makeToken(member.id, member.familyId, member.role, tokenVersion), member: memberOut });
  } catch { res.status(500).json({ error: 'Could not refresh sign-in' }); }
});

// ── Sign out of every device (including this one) ────────────────────────────
router.post('/sign-out-everywhere', authMiddleware, async (req: AuthRequest, res) => {
  try {
    await prisma.member.update({ where: { id: req.memberId }, data: { tokenVersion: { increment: 1 } } });
    await audit(req, 'member.signed_out_everywhere', 'signed out on all devices', { type: 'member', id: req.memberId });
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Could not sign out' }); }
});

// ── Rotate the family code (parent only) ─────────────────────────────────────
// Use this if the code has been shared with someone outside the family.
// Everyone keeps their current session; new sign-ins need the new code.
router.post('/rotate-code', authMiddleware, async (req: AuthRequest, res) => {
  if (!requireParent(req, res)) return;
  try {
    const family = await prisma.family.update({
      where: { id: req.familyId },
      data: { inviteCode: await uniqueInviteCode() },
      select: PUBLIC_FAMILY_SELECT,
    });
    await audit(req, 'family.code_rotated', 'made a new family code', { type: 'family', id: req.familyId });
    res.json({ family });
  } catch {
    res.status(500).json({ error: 'Could not change the family code' });
  }
});

export default router;
