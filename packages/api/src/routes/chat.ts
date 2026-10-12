import { sendBrowserPush } from '../services/webPush';
import { Router } from 'express';
import { AuthRequest } from '../middleware/auth';
import { broadcast } from '../services/websocket';
const router = Router();
import { prisma } from '../db';

router.get('/', async (req: AuthRequest, res) => {
  const messages = await prisma.message.findMany({ where: { familyId: req.familyId }, include: { member: true }, orderBy: { createdAt: 'asc' }, take: 100 });
  res.json(messages);
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const message = await prisma.message.create({ data: { familyId: req.familyId!, memberId: req.memberId!, ...req.body }, include: { member: true } });
    broadcast(req.familyId!, { type: 'message:new', message });
    res.json(message);
    // Delivery is best-effort and must not fail a saved message.
    prisma.member.findMany({where:{familyId:req.familyId,id:{not:req.memberId}}}).then(members=>Promise.allSettled(members.map(m=>sendBrowserPush(m.id,'New family message','Open FamilyHub to read it.','/chat')))).catch(e=>console.error('Chat push failed',e));
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.patch('/:id/pin', async (req: AuthRequest, res) => {
  const message = await prisma.message.update({ where: { id: req.params.id }, data: { pinned: true } });
  res.json(message);
});

router.delete('/:id', async (req: AuthRequest, res) => {
  await prisma.message.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});
export default router;
