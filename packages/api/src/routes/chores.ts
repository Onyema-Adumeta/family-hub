import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { broadcast } from '../services/websocket';

const router = Router();
const prisma = new PrismaClient();

router.get('/', async (req: AuthRequest, res) => {
  const chores = await prisma.chore.findMany({
    where: { familyId: req.familyId },
    include: { assignedTo: true, completedBy: true },
    orderBy: { createdAt: 'desc' }
  });
  res.json(chores);
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const { title, emoji, assignedToId, frequency, stars, proofRequired, dueDate } = req.body;
    const chore = await prisma.chore.create({
      data: { familyId: req.familyId!, title, emoji: emoji || '✅', assignedToId, frequency: frequency || 'daily', stars: stars || 5, proofRequired: proofRequired || false, dueDate: dueDate ? new Date(dueDate) : undefined },
      include: { assignedTo: true }
    });
    broadcast(req.familyId!, { type: 'chore:created', chore });
    res.json(chore);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.patch('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    // Completing a chore with proof
    if (data.done === true) {
      data.completedAt = new Date();
      data.completedById = req.memberId;
      // Award stars
      if (req.memberId) {
        const chore = await prisma.chore.findUnique({ where: { id } });
        if (chore && !chore.done) {
          await prisma.member.update({ where: { id: req.memberId }, data: { stars: { increment: chore.stars } } });
        }
      }
    } else if (data.done === false) {
      data.completedAt = null;
      data.completedById = null;
    }
    const chore = await prisma.chore.update({
      where: { id, familyId: req.familyId },
      data,
      include: { assignedTo: true, completedBy: true }
    });
    broadcast(req.familyId!, { type: 'chore:updated', chore });
    res.json(chore);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  await prisma.chore.delete({ where: { id: req.params.id, familyId: req.familyId } });
  broadcast(req.familyId!, { type: 'chore:deleted', id: req.params.id });
  res.json({ ok: true });
});

// Reset all daily chores (called by cron)
router.post('/reset-daily', async (req: AuthRequest, res) => {
  await prisma.chore.updateMany({ where: { familyId: req.familyId, frequency: 'daily' }, data: { done: false, completedAt: null, completedById: null, proofUrl: null } });
  res.json({ ok: true });
});

export default router;
