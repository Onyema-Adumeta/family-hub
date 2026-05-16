import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { broadcast } from '../services/websocket';
const router = Router();
const prisma = new PrismaClient();

router.get('/', async (req: AuthRequest, res) => {
  const events = await prisma.event.findMany({ where: { familyId: req.familyId }, include: { assignedTo: true }, orderBy: { date: 'asc' } });
  res.json(events);
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const event = await prisma.event.create({ data: { familyId: req.familyId!, ...req.body, date: new Date(req.body.date) }, include: { assignedTo: true } });
    broadcast(req.familyId!, { type: 'event:created', event });
    res.json(event);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  await prisma.event.delete({ where: { id: req.params.id } });
  broadcast(req.familyId!, { type: 'event:deleted', id: req.params.id });
  res.json({ ok: true });
});
export default router;
