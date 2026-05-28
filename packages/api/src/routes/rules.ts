import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// GET /api/rules — list all rules for the family
router.get('/', async (req: AuthRequest, res) => {
  try {
    const rules = await prisma.weeklyRule.findMany({
      where: { familyId: req.familyId },
      include: {
        assignedTo: { select: { id: true, name: true, emoji: true, color: true } },
        createdBy:  { select: { id: true, name: true } },
        outcomes:   { orderBy: { createdAt: 'desc' }, take: 5 },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(rules);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch rules' });
  }
});

// POST /api/rules — create a rule (parent only)
router.post('/', async (req: AuthRequest, res) => {
  if (req.role !== 'parent') return res.status(403).json({ error: 'Parents only' });

  const { assignedToId, label, minStars, consequenceNote } = req.body;
  if (!assignedToId || !minStars) {
    return res.status(400).json({ error: 'assignedToId and minStars are required' });
  }

  try {
    const rule = await prisma.weeklyRule.create({
      data: {
        familyId:        req.familyId!,
        createdById:     req.memberId!,
        assignedToId,
        label:           label || 'Weekly star goal',
        minStars:        Number(minStars),
        consequenceNote: consequenceNote || 'Screen time reduced on weekend',
        active:          true,
      },
      include: {
        assignedTo: { select: { id: true, name: true, emoji: true, color: true } },
        outcomes:   { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
    res.json(rule);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create rule' });
  }
});

// PATCH /api/rules/:id — edit or toggle active (parent only)
router.patch('/:id', async (req: AuthRequest, res) => {
  if (req.role !== 'parent') return res.status(403).json({ error: 'Parents only' });

  const { label, minStars, consequenceNote, active } = req.body;
  try {
    const rule = await prisma.weeklyRule.update({
      where: { id: req.params.id },
      data: {
        ...(label           !== undefined && { label }),
        ...(minStars        !== undefined && { minStars: Number(minStars) }),
        ...(consequenceNote !== undefined && { consequenceNote }),
        ...(active          !== undefined && { active }),
      },
      include: {
        assignedTo: { select: { id: true, name: true, emoji: true, color: true } },
        outcomes:   { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
    res.json(rule);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update rule' });
  }
});

// DELETE /api/rules/:id — delete a rule (parent only)
router.delete('/:id', async (req: AuthRequest, res) => {
  if (req.role !== 'parent') return res.status(403).json({ error: 'Parents only' });
  try {
    await prisma.weeklyRule.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete rule' });
  }
});

// GET /api/rules/my — member's own active rules + current progress
router.get('/my', async (req: AuthRequest, res) => {
  try {
    const rules = await prisma.weeklyRule.findMany({
      where: { assignedToId: req.memberId, active: true },
      include: {
        outcomes: { orderBy: { createdAt: 'desc' }, take: 4 },
      },
    });

    // Calculate stars earned this week
    const weekStart = getWeekStart();

    // Stars earned this week = completed chores this week
    const completedThisWeek = await prisma.chore.findMany({
      where: {
        familyId:     req.familyId,
        assignedToId: req.memberId,
        status:       'done',
        completedAt:  { gte: new Date(weekStart) },
      },
      select: { stars: true },
    });
    const starsThisWeek = completedThisWeek.reduce((sum, c) => sum + (c.stars || 0), 0);

    res.json({ rules, starsThisWeek, weekStart });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch my rules' });
  }
});

function getWeekStart(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d);
  mon.setDate(diff);
  return mon.toISOString().split('T')[0];
}

export default router;