import { Router } from 'express';
import { AuthRequest } from '../middleware/auth';
const router = Router();
import { prisma } from '../db';

// Standard include for every meal response
const mealInclude = {
  assignedTo: { select: { id: true, name: true, emoji: true, color: true } },
  assignees:  { select: { id: true, name: true, emoji: true, color: true } },
};

// Accept assigneeIds[] (new) or fall back to assignedToId (legacy single)
function resolveAssigneeIds(body: any): string[] {
  if (Array.isArray(body.assigneeIds)) {
    return body.assigneeIds.filter((x: any) => typeof x === 'string' && x.length > 0);
  }
  if (body.assignedToId) return [body.assignedToId];
  return [];
}

router.get('/', async (req: AuthRequest, res) => {
  const { week } = req.query;
  const meals = await prisma.meal.findMany({
    where: { familyId: req.familyId!, ...(week ? { week: week as string } : {}) },
    include: mealInclude,
    orderBy: { createdAt: 'asc' },
  });
  res.json(meals);
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const { assigneeIds: _ignore, assignedToId: _ignore2, ...rest } = req.body;
    const assigneeIds = resolveAssigneeIds(req.body);

    const meal = await prisma.meal.create({
      data: {
        familyId: req.familyId!,
        ...rest,
        // Mirror first assignee into assignedToId so legacy reads keep working
        assignedToId: assigneeIds[0] || null,
        assignees: assigneeIds.length ? { connect: assigneeIds.map(id => ({ id })) } : undefined,
      },
      include: mealInclude,
    });
    res.json(meal);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.patch('/:id', async (req: AuthRequest, res) => {
  try {
    const { assigneeIds: _ignore, assignedToId: _ignore2, ...rest } = req.body;

    const updateData: any = { ...rest };

    // Only touch assignees if the request actually included assignment info
    if (req.body.assigneeIds !== undefined || req.body.assignedToId !== undefined) {
      const assigneeIds = resolveAssigneeIds(req.body);
      updateData.assignees    = { set: assigneeIds.map(id => ({ id })) };
      updateData.assignedToId = assigneeIds[0] || null;
    }

    const meal = await prisma.meal.update({
      where: { id: req.params.id },
      data: updateData,
      include: mealInclude,
    });
    res.json(meal);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  await prisma.meal.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

export default router;