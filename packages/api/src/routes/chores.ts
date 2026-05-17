import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { broadcast } from '../services/websocket';

const router = Router();
const prisma = new PrismaClient();

// GET /api/chores
router.get('/', async (req: AuthRequest, res) => {
  try {
    const chores = await prisma.chore.findMany({
      where: { familyId: req.familyId },
      include: {
        assignedTo: { select: { id: true, name: true, emoji: true, color: true, avatarUrl: true } },
        completedBy: { select: { id: true, name: true, emoji: true, color: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(chores);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/chores
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { title, emoji, frequency, stars, proofRequired, assignedToId, dueDate } = req.body;
    const chore = await prisma.chore.create({
      data: {
        familyId: req.familyId!,
        title, emoji: emoji || 'U+1F9F9',
        frequency: frequency || 'daily',
        stars: stars ?? 5,
        proofRequired: proofRequired ?? false,
        assignedToId: assignedToId || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        status: 'pending',
      },
      include: {
        assignedTo: { select: { id: true, name: true, emoji: true, color: true, avatarUrl: true } },
      },
    });
    broadcast(req.familyId!, { type: 'chore:created', chore });
    res.json(chore);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// PATCH /api/chores/:id — advance status: pending -> in_progress -> done
router.patch('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const data: any = { ...req.body };

    // Handle status transitions
    if (data.status === 'done') {
      data.completedAt = new Date();
      data.completedById = req.memberId;
      // Award stars only when moving TO done
      const existing = await prisma.chore.findUnique({ where: { id } });
      if (existing && existing.status !== 'done') {
        await prisma.member.update({
          where: { id: req.memberId },
          data: { stars: { increment: existing.stars } },
        });
      }
    } else if (data.status === 'pending') {
      data.completedAt = null;
      data.completedById = null;
    }

    const chore = await prisma.chore.update({
      where: { id },
      data,
      include: {
        assignedTo: { select: { id: true, name: true, emoji: true, color: true, avatarUrl: true } },
        completedBy: { select: { id: true, name: true, emoji: true, color: true } },
      },
    });
    broadcast(req.familyId!, { type: 'chore:updated', chore });
    res.json(chore);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// DELETE /api/chores/:id
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    await prisma.chore.delete({ where: { id: req.params.id } });
    broadcast(req.familyId!, { type: 'chore:deleted', id: req.params.id });
    res.json({ ok: true });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// POST /api/chores/reset-daily
router.post('/reset-daily', async (req: AuthRequest, res) => {
  await prisma.chore.updateMany({
    where: { familyId: req.familyId, frequency: 'daily' },
    data: { status: 'pending', completedAt: null, completedById: null, proofUrl: null },
  });
  res.json({ ok: true });
});

export default router;
