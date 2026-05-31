import { Router } from 'express';
import { AuthRequest } from '../middleware/auth';
const router = Router();
import { prisma } from '../db';

router.get('/', async (req: AuthRequest, res) => {
  const { week } = req.query;
  const meals = await prisma.meal.findMany({
    where: { familyId: req.familyId!, ...(week ? { week: week as string } : {}) },
    include: { assignedTo: true },
    orderBy: { createdAt: 'asc' }
  });
  res.json(meals);
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const meal = await prisma.meal.create({ data: { familyId: req.familyId!, ...req.body }, include: { assignedTo: true } });
    res.json(meal);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.patch('/:id', async (req: AuthRequest, res) => {
  try {
    const meal = await prisma.meal.update({ where: { id: req.params.id }, data: req.body, include: { assignedTo: true } });
    res.json(meal);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  await prisma.meal.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});
export default router;
