import { Router } from 'express';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../db';
import { membersInFamily, pick } from '../lib/guards';

const router = Router();

// Standard include for every meal response
const mealInclude = {
  assignedTo: { select: { id: true, name: true, emoji: true, color: true } },
  assignees:  { select: { id: true, name: true, emoji: true, color: true } },
};

// Only these fields can be set from the client. familyId always comes from the session.
const MEAL_FIELDS = ['day', 'slot', 'name', 'emoji', 'notes', 'week'] as const;

// Accept assigneeIds[] (new) or fall back to assignedToId (legacy single)
function resolveAssigneeIds(body: any): string[] {
  if (Array.isArray(body.assigneeIds)) return body.assigneeIds.filter((x: any) => typeof x === 'string' && x.length > 0);
  if (body.assignedToId) return [body.assignedToId];
  return [];
}

router.get('/', async (req: AuthRequest, res) => {
  try {
    const { week } = req.query;
    const meals = await prisma.meal.findMany({
      where: { familyId: req.familyId!, ...(week ? { week: String(week) } : {}) },
      include: mealInclude,
      orderBy: { createdAt: 'asc' },
    });
    res.json(meals);
  } catch { res.status(500).json({ error: 'Could not load meals' }); }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const data: any = pick(req.body, MEAL_FIELDS);
    if (typeof data.name !== 'string' || !data.name.trim()) return res.status(400).json({ error: 'name is required' });
    if (typeof data.day !== 'string' || typeof data.week !== 'string') return res.status(400).json({ error: 'day and week are required' });
    const assigneeIds = resolveAssigneeIds(req.body || {});
    if (!(await membersInFamily(assigneeIds, req.familyId!))) return res.status(400).json({ error: 'Invalid assignee' });

    const meal = await prisma.meal.create({
      data: {
        ...data,
        familyId: req.familyId!,
        assignedToId: assigneeIds[0] || null,
        assignees: assigneeIds.length ? { connect: assigneeIds.map(id => ({ id })) } : undefined,
      },
      include: mealInclude,
    });
    res.json(meal);
  } catch { res.status(400).json({ error: 'Could not add meal' }); }
});

router.patch('/:id', async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.meal.findFirst({ where: { id: req.params.id, familyId: req.familyId } });
    if (!existing) return res.status(404).json({ error: 'Meal not found' });

    const updateData: any = pick(req.body, MEAL_FIELDS);
    if (req.body?.assigneeIds !== undefined || req.body?.assignedToId !== undefined) {
      const assigneeIds = resolveAssigneeIds(req.body);
      if (!(await membersInFamily(assigneeIds, req.familyId!))) return res.status(400).json({ error: 'Invalid assignee' });
      updateData.assignees  = { set: assigneeIds.map(id => ({ id })) };
      updateData.assignedTo = assigneeIds[0] ? { connect: { id: assigneeIds[0] } } : { disconnect: true };
    }

    const meal = await prisma.meal.update({ where: { id: existing.id }, data: updateData, include: mealInclude });
    res.json(meal);
  } catch { res.status(400).json({ error: 'Could not update meal' }); }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const result = await prisma.meal.deleteMany({ where: { id: req.params.id, familyId: req.familyId } });
    if (!result.count) return res.status(404).json({ error: 'Meal not found' });
    res.json({ ok: true });
  } catch { res.status(400).json({ error: 'Could not delete meal' }); }
});

export default router;
