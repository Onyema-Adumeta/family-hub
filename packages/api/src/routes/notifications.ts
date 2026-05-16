import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
const router = Router();
const prisma = new PrismaClient();

router.get('/', async (req: AuthRequest, res) => {
  const notifications = await prisma.notification.findMany({ where: { familyId: req.familyId, OR: [{ memberId: req.memberId }, { memberId: null }] }, orderBy: { createdAt: 'desc' }, take: 30 });
  res.json(notifications);
});

router.patch('/:id/read', async (req: AuthRequest, res) => {
  await prisma.notification.update({ where: { id: req.params.id }, data: { read: true } });
  res.json({ ok: true });
});

router.patch('/read-all', async (req: AuthRequest, res) => {
  await prisma.notification.updateMany({ where: { familyId: req.familyId, memberId: req.memberId }, data: { read: true } });
  res.json({ ok: true });
});
export default router;
