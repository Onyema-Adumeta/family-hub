import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { broadcast } from '../services/websocket';

const router = Router();
const prisma = new PrismaClient();

// GET /api/rewards
router.get('/', async (req: AuthRequest, res) => {
  try {
    const rewards = await prisma.reward.findMany({
      where: { familyId: req.familyId },
      orderBy: { starCost: 'asc' },
    });
    res.json(rewards);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/rewards
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { title, emoji, starCost, description } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'title is required' });
    const reward = await prisma.reward.create({
      data: {
        familyId:    req.familyId!,
        title:       title.trim(),
        emoji:       emoji || '🎁',
        starCost:    Number(starCost) || 10,
        description: description || null,
      },
    });
    broadcast(req.familyId!, { type: 'reward:created', reward });
    res.json(reward);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// DELETE /api/rewards/:id
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    await prisma.reward.delete({ where: { id: req.params.id } });
    broadcast(req.familyId!, { type: 'reward:deleted', id: req.params.id });
    res.json({ ok: true });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// GET /api/rewards/redemptions
router.get('/redemptions', async (req: AuthRequest, res) => {
  try {
    const redemptions = await prisma.redemption.findMany({
      where: { member: { familyId: req.familyId } },
      include: {
        reward:  true,
        member: { select: { id: true, name: true, emoji: true, color: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(redemptions);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/rewards/redeem/:rewardId  — child requests a reward
router.post('/redeem/:rewardId', async (req: AuthRequest, res) => {
  try {
    const reward = await prisma.reward.findUnique({ where: { id: req.params.rewardId } });
    if (!reward) return res.status(404).json({ error: 'Reward not found' });

    const member = await prisma.member.findUnique({ where: { id: req.memberId } });
    if (!member) return res.status(404).json({ error: 'Member not found' });
    if ((member.stars ?? 0) < reward.starCost) {
      return res.status(400).json({ error: `Need ${reward.starCost} stars, you have ${member.stars}` });
    }

    // Create redemption as "pending" — parent must approve
    const redemption = await prisma.redemption.create({
      data: {
        memberId: req.memberId!,
        rewardId: reward.id,
        status:   'pending',
      },
      include: {
        reward:  true,
        member: { select: { id: true, name: true, emoji: true } },
      },
    });

    // Deduct stars immediately (refund on rejection)
    await prisma.member.update({
      where: { id: req.memberId },
      data:  { stars: { decrement: reward.starCost } },
    });

    broadcast(req.familyId!, { type: 'redemption:requested', redemption });
    res.json(redemption);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// PATCH /api/rewards/redemptions/:id  — parent approves or rejects
router.patch('/redemptions/:id', async (req: AuthRequest, res) => {
  try {
    const { approved } = req.body;
    const redemption = await prisma.redemption.findUnique({
      where: { id: req.params.id },
      include: { reward: true },
    });
    if (!redemption) return res.status(404).json({ error: 'Redemption not found' });
    if (redemption.status !== 'pending') {
      return res.status(400).json({ error: 'Already processed' });
    }

    if (approved) {
      // Mark as approved — stars already deducted
      await prisma.redemption.update({
        where: { id: redemption.id },
        data:  { status: 'approved' },
      });
    } else {
      // Reject — refund the stars
      await prisma.redemption.update({
        where: { id: redemption.id },
        data:  { status: 'rejected' },
      });
      await prisma.member.update({
        where: { id: redemption.memberId },
        data:  { stars: { increment: redemption.reward.starCost } },
      });
    }

    const updated = await prisma.redemption.findUnique({
      where: { id: redemption.id },
      include: {
        reward:  true,
        member: { select: { id: true, name: true, emoji: true } },
      },
    });

    broadcast(req.familyId!, {
      type: approved ? 'redemption:approved' : 'redemption:rejected',
      redemption: updated,
    });
    res.json(updated);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

export default router;