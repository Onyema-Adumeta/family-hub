import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../db';
import { PUBLIC_MEMBER_SELECT, SELF_MEMBER_SELECT, requireParent } from '../lib/guards';
import { PasswordSchema, hashPassword, makeToken, newPasswordProblem } from './auth';
import { audit } from '../services/audit';
import { deleteMemberData } from '../services/familyData';
import { uploader, uploadedUrl } from '../services/media';
import { sendVerificationEmail } from '../services/authTokens';
import { z } from 'zod';

const router = Router();

// GET /api/members — list all members in the family (safe fields only)
router.get('/', async (req: AuthRequest, res) => {
  try {
    const members = await prisma.member.findMany({
      where: { familyId: req.familyId },
      select: PUBLIC_MEMBER_SELECT,
      orderBy: { createdAt: 'asc' },
    });
    res.json(members);
  } catch {
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// Name-based dashboard selection. IDs stay internal to the application.
router.get('/dashboard-access', async (req: AuthRequest, res) => {
  try {
    const members = await prisma.member.findMany({
      where: { familyId: req.familyId, ...(req.role === 'parent' ? {} : { id: req.memberId }) },
      select: { id: true, name: true, role: true, canOpenPersonalOS: true, canOpenPremed: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json(members);
  } catch { res.status(500).json({ error: 'Could not load dashboard access' }); }
});

router.patch('/:id/dashboard-access', async (req: AuthRequest, res) => {
  if (req.role !== 'parent') return res.status(403).json({ error: 'Only parents can manage dashboard links' });
  const { canOpenPersonalOS, canOpenPremed } = req.body || {};
  if (typeof canOpenPersonalOS !== 'boolean' || typeof canOpenPremed !== 'boolean') return res.status(400).json({ error: 'Choose dashboard access' });
  try {
    const result = await prisma.member.updateMany({
      where: { id: req.params.id, familyId: req.familyId },
      data: { canOpenPersonalOS, canOpenPremed },
    });
    if (!result.count) return res.status(404).json({ error: 'Member not found' });
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Could not save dashboard access' }); }
});

router.patch('/:id/reward-goal', async (req: AuthRequest, res) => {
  if (req.memberId !== req.params.id && req.role !== 'parent') return res.status(403).json({ error: 'Choose your own reward goal' });
  const { rewardId } = req.body || {};
  if (rewardId !== null && typeof rewardId !== 'string') return res.status(400).json({ error: 'Choose a reward' });
  try {
    if (rewardId) {
      const reward = await prisma.reward.findFirst({ where: { id: rewardId, familyId: req.familyId } });
      if (!reward) return res.status(404).json({ error: 'Reward not found' });
    }
    const result = await prisma.member.updateMany({ where: { id: req.params.id, familyId: req.familyId }, data: { rewardGoalId: rewardId } });
    if (!result.count) return res.status(404).json({ error: 'Member not found' });
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Could not save reward goal' }); }
});

// PATCH /api/members/:id/role — parent promotes/demotes another member
router.patch('/:id/role', async (req: AuthRequest, res) => {
  if (!requireParent(req, res)) return;
  const { role } = req.body || {};
  if (role !== 'parent' && role !== 'child') return res.status(400).json({ error: 'Role must be parent or child' });
  if (req.params.id === req.memberId) return res.status(400).json({ error: 'You cannot change your own role' });
  try {
    const result = await prisma.member.updateMany({ where: { id: req.params.id, familyId: req.familyId }, data: { role } });
    if (!result.count) return res.status(404).json({ error: 'Member not found' });
    const member = await prisma.member.findUnique({ where: { id: req.params.id }, select: PUBLIC_MEMBER_SELECT });
    await audit(req, 'member.role_changed', `made ${member?.name} a ${role === 'parent' ? 'parent' : 'kid'}`, { type: 'member', id: req.params.id });
    res.json(member);
  } catch { res.status(500).json({ error: 'Could not change role' }); }
});

// PUT /api/members/:id/password — change your own password, or a parent resets someone's
router.put('/:id/password', async (req: AuthRequest, res) => {
  const { id } = req.params;
  const isSelf = req.memberId === id;
  if (!isSelf && req.role !== 'parent') return res.status(403).json({ error: 'Not allowed' });
  const parsed = PasswordSchema.safeParse(req.body?.password);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });
  try {
    const target = await prisma.member.findFirst({ where: { id, familyId: req.familyId }, select: { id: true, name: true, password: true, role: true, familyId: true } });
    if (!target) return res.status(404).json({ error: 'Member not found' });
    const problem = newPasswordProblem(parsed.data, target.role);
    if (problem) return res.status(400).json({ error: problem });
    // Changing your own (existing) password requires the current one.
    // A parent resetting a child's or partner's password does not.
    if (isSelf && target.password) {
      const current = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
      if (!(await bcrypt.compare(current, target.password))) return res.status(400).json({ error: 'Current password is incorrect' });
    }
    // A new password signs that member out on every other device.
    const updated = await prisma.member.update({
      where: { id },
      data: { password: await hashPassword(parsed.data), tokenVersion: { increment: 1 } },
      select: { tokenVersion: true },
    });
    await audit(req, isSelf ? 'member.password_changed' : 'member.password_reset', isSelf ? 'changed their password' : `reset ${target.name}'s password`, { type: 'member', id });
    // Keep the person who changed their own password signed in on this device.
    res.json({ ok: true, ...(isSelf ? { token: makeToken(id, target.familyId, target.role, updated.tokenVersion) } : {}) });
  } catch { res.status(500).json({ error: 'Could not change password' }); }
});

// PUT /api/members/:id/email — add or change your own email (needs your password).
// The new address must be confirmed from the emailed link before it can be used.
router.put('/:id/email', async (req: AuthRequest, res) => {
  if (req.params.id !== req.memberId) return res.status(403).json({ error: 'You can only change your own email' });
  const email = z.string().trim().toLowerCase().pipe(z.string().email().max(200)).safeParse(req.body?.email);
  if (!email.success) return res.status(400).json({ error: 'Enter a valid email address' });
  try {
    const me = await prisma.member.findUniqueOrThrow({ where: { id: req.memberId }, select: { id: true, name: true, password: true } });
    const current = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
    if (me.password && !(await bcrypt.compare(current, me.password))) return res.status(400).json({ error: 'Current password is incorrect' });
    const updated = await prisma.member.update({
      where: { id: me.id },
      data: { email: email.data, emailVerifiedAt: null },
      select: SELF_MEMBER_SELECT,
    });
    await prisma.authToken.deleteMany({ where: { memberId: me.id } });
    const emailSent = await sendVerificationEmail({ id: me.id, name: me.name, email: email.data });
    await audit(req, 'member.email_changed', 'changed their email address', { type: 'member', id: me.id });
    res.json({ member: updated, emailSent });
  } catch { res.status(500).json({ error: 'Could not change email' }); }
});

// POST /api/members/:id/sign-out — a parent signs a member out on all devices
// (e.g. a lost phone). Their next request asks them to sign in again.
router.post('/:id/sign-out', async (req: AuthRequest, res) => {
  if (!requireParent(req, res)) return;
  try {
    const target = await prisma.member.findFirst({ where: { id: req.params.id, familyId: req.familyId }, select: { id: true, name: true } });
    if (!target) return res.status(404).json({ error: 'Member not found' });
    await prisma.member.update({ where: { id: target.id }, data: { tokenVersion: { increment: 1 } } });
    await audit(req, 'member.signed_out', `signed ${target.name} out on all devices`, { type: 'member', id: target.id });
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Could not sign out member' }); }
});

// POST /api/members/:id/avatar — a profile photo (yourself, or a parent for anyone in the family)
const avatarUpload = uploader({ folder: 'avatars', field: 'avatar', videos: false, maxMb: 5 });
router.post('/:id/avatar', async (req: AuthRequest, res, next) => {
  // Check access before accepting the file.
  const isSelf = req.params.id === req.memberId;
  if (!isSelf && req.role !== 'parent') return res.status(403).json({ error: 'You can only change your own photo' });
  const target = await prisma.member.findFirst({ where: { id: req.params.id, familyId: req.familyId }, select: { id: true } });
  if (!target) return res.status(404).json({ error: 'Member not found' });
  avatarUpload(req, res, (err: any) => {
    if (err?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'That photo is too big (5 MB at most).' });
    if (err) { console.error('avatar upload failed', err); return res.status(500).json({ error: 'Could not upload the photo. Please try again.' }); }
    next();
  });
}, async (req: AuthRequest, res) => {
  if (!req.file) return res.status(400).json({ error: 'Choose a photo (JPEG, PNG, WebP, GIF or HEIC).' });
  try {
    const isSelf = req.params.id === req.memberId;
    const member = await prisma.member.update({
      where: { id: req.params.id },
      data: { avatarUrl: uploadedUrl(req.file) },
      select: isSelf ? SELF_MEMBER_SELECT : PUBLIC_MEMBER_SELECT,
    });
    res.json(member);
  } catch { res.status(500).json({ error: 'Could not save the photo' }); }
});

// PATCH /api/members/:id — update profile (name, emoji, color, avatar, birthday)
router.patch('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { name, emoji, color, avatarUrl, avatar, pushToken, birthday } = req.body || {};
  const isSelf = req.memberId === id;

  // Members can only edit themselves; parents can edit anyone in their family
  if (!isSelf && req.role !== 'parent') return res.status(403).json({ error: 'Not allowed' });
  if (name !== undefined && (typeof name !== 'string' || !name.trim() || name.length > 50)) return res.status(400).json({ error: 'Invalid name' });
  if (color !== undefined && (typeof color !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(color))) return res.status(400).json({ error: 'Invalid colour' });
  if (emoji !== undefined && (typeof emoji !== 'string' || emoji.length > 10)) return res.status(400).json({ error: 'Invalid emoji' });
  const avatarValue = avatarUrl !== undefined ? avatarUrl : avatar;
  if (avatarValue !== undefined && avatarValue !== null && (typeof avatarValue !== 'string' || !/^https:\/\//.test(avatarValue))) return res.status(400).json({ error: 'Invalid avatar URL' });

  try {
    const target = await prisma.member.findFirst({ where: { id, familyId: req.familyId }, select: { id: true } });
    if (!target) return res.status(404).json({ error: 'Member not found' });
    const updated = await prisma.member.update({
      where: { id },
      data: {
        ...(name        !== undefined && { name: name.trim() }),
        ...(emoji       !== undefined && { emoji }),
        ...(color       !== undefined && { color }),
        ...(avatarValue !== undefined && { avatarUrl: avatarValue }),
        // A push token is device-specific: only the member themselves may set it.
        ...(pushToken   !== undefined && isSelf && { pushToken }),
        ...(birthday    !== undefined && { birthday: birthday ? new Date(birthday) : null }),
      },
      select: isSelf ? SELF_MEMBER_SELECT : PUBLIC_MEMBER_SELECT,
    });
    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Failed to update member' });
  }
});

// DELETE /api/members/:id — parent only, cannot remove yourself
router.delete('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;
  if (req.role !== 'parent') return res.status(403).json({ error: 'Only parents can remove members' });
  if (req.memberId === id) return res.status(400).json({ error: 'You cannot remove yourself' });

  const target = await prisma.member.findFirst({ where: { id, familyId: req.familyId } });
  if (!target) return res.status(404).json({ error: 'Member not found' });

  try {
    await deleteMemberData(id, req.familyId!, req.memberId!);
    await audit(req, 'member.removed', `removed ${target.name} from the family`, { type: 'member', id });
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

export default router;
