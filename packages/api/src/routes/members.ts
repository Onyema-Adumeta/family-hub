import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../db';
import { PUBLIC_MEMBER_SELECT, SELF_MEMBER_SELECT, requireParent } from '../lib/guards';
import { PasswordSchema, hashPassword } from './auth';

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
    const target = await prisma.member.findFirst({ where: { id, familyId: req.familyId }, select: { id: true, password: true } });
    if (!target) return res.status(404).json({ error: 'Member not found' });
    // Changing your own (existing) password requires the current one.
    // A parent resetting a child's or partner's password does not.
    if (isSelf && target.password) {
      const current = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
      if (!(await bcrypt.compare(current, target.password))) return res.status(400).json({ error: 'Current password is incorrect' });
    }
    await prisma.member.update({ where: { id }, data: { password: await hashPassword(parsed.data) } });
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Could not change password' }); }
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
    await prisma.$transaction([
      prisma.chore.updateMany({ where: { assignedToId: id, familyId: req.familyId }, data: { assignedToId: null } }),
      prisma.message.deleteMany({ where: { memberId: id } }),
      prisma.member.delete({ where: { id } }),
    ]);
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

export default router;
