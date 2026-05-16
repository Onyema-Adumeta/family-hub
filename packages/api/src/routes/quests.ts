import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
const router = Router();
const prisma = new PrismaClient();

router.get('/', async (req: AuthRequest, res) => {
  const quests = await prisma.quest.findMany({ where: { familyId: req.familyId }, orderBy: { createdAt: 'desc' } });
  res.json(quests);
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const quest = await prisma.quest.create({ data: { familyId: req.familyId!, ...req.body, deadline: req.body.deadline ? new Date(req.body.deadline) : undefined } });
    res.json(quest);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.post('/:id/complete', async (req: AuthRequest, res) => {
  try {
    const quest = await prisma.quest.findUnique({ where: { id: req.params.id } });
    if (!quest) return res.status(404).json({ error: 'Quest not found' });
    if (quest.completedAt) return res.status(400).json({ error: 'Quest already completed' });

    const [updated] = await prisma.$transaction([
      prisma.quest.update({
        where: { id: req.params.id },
        data: { completedAt: new Date() },
      }),
      prisma.member.update({
        where: { id: req.memberId },
        data: {
          stars: { increment: quest.reward },
          totalChoresDone: { increment: 1 },
        },
      }),
    ]);

    res.json(updated);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.patch('/:id', async (req: AuthRequest, res) => {
  try {
    const data = { ...req.body };
    if (data.deadline) data.deadline = new Date(data.deadline);
    const quest = await prisma.quest.update({ where: { id: req.params.id }, data });
    res.json(quest);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  await prisma.quest.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

export default router;