import { Router } from 'express';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../db';
import { requireParent } from '../lib/guards';
import { audit } from '../services/audit';
import { familyGoalProgress } from '../services/goals';
import { broadcast } from '../services/websocket';

const router = Router();

// GET /api/goals — the active family goal with progress, plus recent finished ones
router.get('/', async (req: AuthRequest, res) => {
  try {
    const active = await familyGoalProgress(req.familyId!);
    const past = await prisma.familyGoal.findMany({
      where: { familyId: req.familyId, archivedAt: { not: null } },
      orderBy: { createdAt: 'desc' }, take: 5,
      select: { id: true, title: true, emoji: true, reward: true, targetStars: true, reachedAt: true, createdAt: true },
    });
    res.json({ active, past });
  } catch { res.status(500).json({ error: 'Could not load family goal' }); }
});

// POST /api/goals — a parent starts a new goal (the previous one is archived)
router.post('/', async (req: AuthRequest, res) => {
  if (!requireParent(req, res)) return;
  const { title, emoji, reward, targetStars } = req.body || {};
  const target = Number(targetStars);
  if (typeof title !== 'string' || !title.trim() || title.length > 100) return res.status(400).json({ error: 'Give the goal a name' });
  if (!Number.isInteger(target) || target < 1 || target > 100000) return res.status(400).json({ error: 'Target must be a whole number of stars' });
  try {
    await prisma.familyGoal.updateMany({ where: { familyId: req.familyId, archivedAt: null }, data: { archivedAt: new Date() } });
    const goal = await prisma.familyGoal.create({
      data: { familyId: req.familyId!, title: title.trim(), emoji: emoji || '🎯', reward: reward ? String(reward).slice(0, 200) : null, targetStars: target, createdById: req.memberId },
    });
    await audit(req, 'goal.created', `started the family goal "${goal.title}" (${target}⭐)`, { type: 'goal', id: goal.id });
    const progress = await familyGoalProgress(req.familyId!);
    broadcast(req.familyId!, { type: 'goal:updated', goal: progress });
    res.json(progress);
  } catch { res.status(500).json({ error: 'Could not create goal' }); }
});

// POST /api/goals/:id/archive — a parent ends a goal (finished or abandoned)
router.post('/:id/archive', async (req: AuthRequest, res) => {
  if (!requireParent(req, res)) return;
  try {
    const r = await prisma.familyGoal.updateMany({ where: { id: req.params.id, familyId: req.familyId, archivedAt: null }, data: { archivedAt: new Date() } });
    if (!r.count) return res.status(404).json({ error: 'Goal not found' });
    broadcast(req.familyId!, { type: 'goal:updated', goal: null });
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Could not end goal' }); }
});

export default router;
