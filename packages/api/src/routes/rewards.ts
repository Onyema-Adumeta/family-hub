import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
const router = Router();
const prisma = new PrismaClient();

router.get('/', async (req: AuthRequest, res) => {
  const rewards = await prisma.reward.findMany({ where: { familyId: req.familyId }, orderBy: { cost: 'asc' } });
  res.json(rewards);
});

router.get('/redemptions', async (req: AuthRequest, res) => {
  const redemptions = await prisma.redemption.findMany({ where: { familyId: req.familyId }, include: { member: true, reward: true }, orderBy: { createdAt: 'desc' } });
  res.json(redemptions);
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const reward = await prisma.reward.create({ data: { familyId: req.familyId!, ...req.body } });
    res.json(reward);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.post('/redeem/:rewardId', async (req: AuthRequest, res) => {
  try {
    const reward = await prisma.reward.findUnique({ where: { id: req.params.rewardId } });
    if (!reward) return res.status(404).json({ error: 'Reward not found' });
    const member = await prisma.member.findUnique({ where: { id: req.memberId } });
    if (!member || member.stars < reward.cost) return res.status(400).json({ error: 'Not enough stars' });
    await prisma.member.update({ where: { id: req.memberId }, data: { stars: { decrement: reward.cost } } });
    const redemption = await prisma.redemption.create({ data: { familyId: req.familyId!, memberId: req.memberId!, rewardId: reward.id }, include: { member: true, reward: true } });
    res.json(redemption);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.patch('/:id', async (req: AuthRequest, res) => {
  const reward = await prisma.reward.update({ where: { id: req.params.id }, data: req.body });
  res.json(reward);
});

router.delete('/:id', async (req: AuthRequest, res) => {
  await prisma.reward.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});
export default router;
