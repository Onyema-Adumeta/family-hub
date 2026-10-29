import { Router } from 'express';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../db';
import { audit } from '../services/audit';
import { memberInFamily, pick, requireParent } from '../lib/guards';

const router = Router();
const questInclude = { member: { select: { id: true, name: true, emoji: true, color: true } } };
const MAX_STARS = 1000;

function validStars(v: any) {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= MAX_STARS ? n : null;
}

// ── GET all quests for family ─────────────────────────────────────────────────
router.get('/', async (req: AuthRequest, res) => {
  try {
    const quests = await prisma.quest.findMany({ where: { familyId: req.familyId }, include: questInclude, orderBy: { createdAt: 'desc' } });
    res.json(quests);
  } catch { res.status(500).json({ error: 'Could not load quests' }); }
});

// ── CREATE quest (parents) ────────────────────────────────────────────────────
router.post('/', async (req: AuthRequest, res) => {
  if (!requireParent(req, res)) return;
  try {
    const { title, description, emoji, difficulty, stars, memberId, deadline, stages } = req.body || {};
    if (typeof title !== 'string' || !title.trim()) return res.status(400).json({ error: 'title is required' });
    const starValue = stars === undefined ? 10 : validStars(stars);
    if (starValue === null) return res.status(400).json({ error: `Stars must be a whole number from 0 to ${MAX_STARS}` });
    if (memberId && !(await memberInFamily(memberId, req.familyId!))) return res.status(400).json({ error: 'Invalid member' });
    const quest = await prisma.quest.create({
      data: {
        familyId: req.familyId!,
        title: title.trim(),
        description: description || null,
        emoji: emoji || '⚔️',
        difficulty: difficulty || 'easy',
        stars: starValue,
        reward: starValue,
        memberId: memberId || null,
        deadline: deadline ? new Date(deadline) : null,
        stages: Array.isArray(stages) ? stages : [],
      },
      include: questInclude,
    });
    await audit(req, 'quest.created', `created quest "${quest.title}" (${quest.stars}⭐)`, { type: 'quest', id: quest.id });
    res.json(quest);
  } catch { res.status(400).json({ error: 'Could not create quest' }); }
});

// ── COMPLETE a quest (awards stars once) ──────────────────────────────────────
router.post('/:id/complete', async (req: AuthRequest, res) => {
  try {
    const quest = await prisma.quest.findFirst({ where: { id: req.params.id, familyId: req.familyId } });
    if (!quest) return res.status(404).json({ error: 'Quest not found' });
    if (quest.memberId && quest.memberId !== req.memberId && req.role !== 'parent') {
      return res.status(403).json({ error: 'This quest belongs to someone else' });
    }

    const starsToAward = quest.stars || quest.reward || 10;
    const targetMemberId = quest.memberId || req.memberId!;

    const updated = await prisma.$transaction(async tx => {
      const claimed = await tx.quest.updateMany({
        where: { id: quest.id, familyId: req.familyId, completedAt: null },
        data: { completedAt: new Date(), completed: true },
      });
      if (claimed.count !== 1) return null;
      await tx.member.update({
        where: { id: targetMemberId },
        data: { stars: { increment: starsToAward }, totalChoresDone: { increment: 1 } },
      });
      return tx.quest.findUnique({ where: { id: quest.id } });
    });
    if (!updated) return res.status(400).json({ error: 'Quest already completed' });
    await audit(req, 'quest.completed', `completed quest "${quest.title}" (${starsToAward}⭐)`, { type: 'quest', id: quest.id });
    res.json(updated);
  } catch { res.status(400).json({ error: 'Could not complete quest' }); }
});

// ── UPDATE stage progress (owner or parent) ───────────────────────────────────
router.patch('/:id/stages', async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.quest.findFirst({ where: { id: req.params.id, familyId: req.familyId } });
    if (!existing) return res.status(404).json({ error: 'Quest not found' });
    if (existing.memberId && existing.memberId !== req.memberId && req.role !== 'parent') return res.status(403).json({ error: 'This quest belongs to someone else' });
    const { stages } = req.body || {};
    if (!Array.isArray(stages)) return res.status(400).json({ error: 'stages must be a list' });
    const quest = await prisma.quest.update({ where: { id: existing.id }, data: { stages }, include: questInclude });
    res.json(quest);
  } catch { res.status(400).json({ error: 'Could not update quest' }); }
});

// ── UPDATE quest (parents) ────────────────────────────────────────────────────
router.patch('/:id', async (req: AuthRequest, res) => {
  if (!requireParent(req, res)) return;
  try {
    const existing = await prisma.quest.findFirst({ where: { id: req.params.id, familyId: req.familyId } });
    if (!existing) return res.status(404).json({ error: 'Quest not found' });
    const data: any = pick(req.body, ['title', 'description', 'emoji', 'difficulty', 'stars', 'memberId', 'deadline', 'stages'] as const);
    if (data.stars !== undefined) {
      const s = validStars(data.stars);
      if (s === null) return res.status(400).json({ error: `Stars must be a whole number from 0 to ${MAX_STARS}` });
      data.stars = s; data.reward = s;
    }
    if (data.memberId && !(await memberInFamily(data.memberId, req.familyId!))) return res.status(400).json({ error: 'Invalid member' });
    if (data.deadline !== undefined) data.deadline = data.deadline ? new Date(data.deadline) : null;
    const quest = await prisma.quest.update({ where: { id: existing.id }, data, include: questInclude });
    res.json(quest);
  } catch { res.status(400).json({ error: 'Could not update quest' }); }
});

// ── DELETE quest (parents) ────────────────────────────────────────────────────
router.delete('/:id', async (req: AuthRequest, res) => {
  if (!requireParent(req, res)) return;
  try {
    const victim = await prisma.quest.findFirst({ where: { id: req.params.id, familyId: req.familyId }, select: { title: true } });
    const result = await prisma.quest.deleteMany({ where: { id: req.params.id, familyId: req.familyId } });
    if (!result.count) return res.status(404).json({ error: 'Quest not found' });
    await audit(req, 'quest.deleted', `deleted quest "${victim?.title}"`, { type: 'quest', id: req.params.id });
    res.json({ ok: true });
  } catch { res.status(400).json({ error: 'Could not delete quest' }); }
});

export default router;
