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

const router = Router();

// ── Rate limiters ─────────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20 * Number(process.env.RATE_LIMIT_MULTIPLIER || 1),
  message: { error: 'Too many attempts, please try again in 15 minutes.' },
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
    const code = String(req.body?.familyCode || '').trim().toUpperCase().replace(/\s+/g, '');
    const name = String(req.body?.name || '').trim().toLowerCase();
    return `acct:${code}:${name}`;
  },
  message: { error: 'Too many wrong attempts for this account. Try again in 15 minutes, or ask a parent to reset your password.' },
  standardHeaders: true,
  legacyHeaders: false,
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

const RegisterSchema = z.object({
  familyName: z.string().min(1).max(50).trim(),
  name:       z.string().min(1).max(50).trim(),
  password:   PasswordSchema,
  emoji:      z.string().max(10).optional(),
  color:      z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  email:      z.string().email().optional().or(z.literal('')),
});

const LoginSchema = z.object({
  familyCode: z.string().min(1).max(20).trim().toUpperCase().transform(s => s.replace(/\s+/g, '')),
  name:       z.string().min(1).max(50).trim(),
  password:   PasswordSchema,
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
    const family = await prisma.family.create({
      data: {
        name: familyName,
        inviteCode: await uniqueInviteCode(),
        members: {
          create: {
            name, emoji: emoji || '👨', color: color || '#6366F1',
            role: 'parent', password: await hashPassword(password), email: email || null, stars: 0,
          },
        },
      },
      select: { ...PUBLIC_FAMILY_SELECT, members: { select: SELF_MEMBER_SELECT } },
    });
    const { members, ...familyOut } = family;
    const member = members[0];
    await audit({ familyId: family.id, memberId: member.id } as any, 'family.created', `created the family "${familyName}"`, { type: 'family', id: family.id });
    res.json({ token: makeToken(member.id, family.id, member.role, 0), member, family: familyOut });
  } catch (e) {
    console.error('register error', e);
    res.status(500).json({ error: 'Could not create family' });
  }
});

// ── Login ─────────────────────────────────────────────────────────────────────
router.post('/login', authLimiter, accountLimiter, async (req, res) => {
  try {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });
    const { familyCode, name, password } = parsed.data;

    const family = await prisma.family.findUnique({ where: { inviteCode: familyCode }, select: PUBLIC_FAMILY_SELECT });
    const found = family
      ? await prisma.member.findFirst({
          where: { familyId: family.id, name: { equals: name, mode: 'insensitive' } },
          select: { id: true, password: true, tokenVersion: true },
        })
      : null;

    let passwordCreated = false;
    if (!family || !found) {
      await bcrypt.compare(password, DUMMY_HASH);
      return res.status(401).json({ error: LOGIN_FAILED });
    }

    if (!found.password) {
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
    res.json({ token: makeToken(member.id, family.id, member.role, found.tokenVersion), member, family, passwordCreated });
  } catch (e) {
    console.error('login error', e);
    res.status(500).json({ error: 'Could not sign in' });
  }
});

// ── Join ──────────────────────────────────────────────────────────────────────
router.post('/join', authLimiter, async (req, res) => {
  try {
    const parsed = JoinSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });
    const { inviteCode, name, password, emoji, color } = parsed.data;
    const family = await prisma.family.findUnique({ where: { inviteCode }, select: PUBLIC_FAMILY_SELECT });
    if (!family) return res.status(400).json({ error: 'Invalid invite code' });

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
