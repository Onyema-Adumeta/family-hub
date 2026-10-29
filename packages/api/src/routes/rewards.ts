import { Router } from 'express';
import { AuthRequest } from '../middleware/auth';
import { broadcast } from '../services/websocket';
import { notifyMember, notifyParents } from '../services/notify';
import { prisma } from '../db';
import { audit } from '../services/audit';
import { requireParent } from '../lib/guards';

const router = Router();

const redemptionInclude = {
  reward: true,
  member: { select: { id: true, name: true, emoji: true, color: true, avatarUrl: true } },
};

// GET /api/rewards
router.get('/', async (req: AuthRequest, res) => {
  try {
    const rewards = await prisma.reward.findMany({ where: { familyId: req.familyId }, orderBy: { cost: 'asc' } });
    res.json(rewards);
  } catch { res.status(500).json({ error: 'Could not load rewards' }); }
});

// POST /api/rewards — parents only
router.post('/', async (req: AuthRequest, res) => {
  if (!requireParent(req, res)) return;
  try {
    const { title, name, emoji, starCost, cost, description } = req.body || {};
    const rewardName = String(title || name || '').trim();
    const rewardCost = Number(starCost ?? cost ?? 10);
    if (!rewardName || rewardName.length > 100) return res.status(400).json({ error: 'name is required' });
    if (!Number.isInteger(rewardCost) || rewardCost < 1 || rewardCost > 100000) return res.status(400).json({ error: 'Cost must be a whole number of stars' });

    const reward = await prisma.reward.create({
      data: {
        familyId:    req.familyId!,
        name:        rewardName,
        emoji:       emoji || '🎁',
        cost:        rewardCost,
        description: description || null,
      },
    });
    broadcast(req.familyId!, { type: 'reward:created', reward });
    await audit(req, 'reward.created', `created reward "${reward.name}" (${reward.cost}⭐)`, { type: 'reward', id: reward.id });
    res.json(reward);
  } catch { res.status(400).json({ error: 'Could not create reward' }); }
});

// DELETE /api/rewards/:id — parents only
router.delete('/:id', async (req: AuthRequest, res) => {
  if (!requireParent(req, res)) return;
  try {
    const reward = await prisma.reward.findFirst({ where: { id: req.params.id, familyId: req.familyId } });
    if (!reward) return res.status(404).json({ error: 'Reward not found' });
    const pending = await prisma.redemption.count({ where: { rewardId: reward.id, approved: false, status: 'pending' } });
    if (pending) return res.status(400).json({ error: 'Approve or decline pending requests for this reward first' });
    await prisma.$transaction([
      prisma.member.updateMany({ where: { familyId: req.familyId, rewardGoalId: reward.id }, data: { rewardGoalId: null } }),
      prisma.redemption.deleteMany({ where: { rewardId: reward.id } }),
      prisma.reward.delete({ where: { id: reward.id } }),
    ]);
    broadcast(req.familyId!, { type: 'reward:deleted', id: req.params.id });
    await audit(req, 'reward.deleted', `deleted reward "${reward.name}"`, { type: 'reward', id: reward.id });
    res.json({ ok: true });
  } catch { res.status(400).json({ error: 'Could not delete reward' }); }
});

// GET /api/rewards/redemptions
router.get('/redemptions', async (req: AuthRequest, res) => {
  try {
    const redemptions = await prisma.redemption.findMany({
      where: { familyId: req.familyId },
      include: redemptionInclude,
      orderBy: { createdAt: 'desc' },
    });
    res.json(redemptions);
  } catch { res.status(500).json({ error: 'Could not load requests' }); }
});

// POST /api/rewards/redeem/:rewardId — a member requests a reward
router.post('/redeem/:rewardId', async (req: AuthRequest, res) => {
  try {
    const reward = await prisma.reward.findFirst({ where: { id: req.params.rewardId, familyId: req.familyId } });
    if (!reward) return res.status(404).json({ error: 'Reward not found' });

    const result = await prisma.$transaction(async tx => {
      // Conditional decrement: never lets two quick taps spend the same stars twice
      // or take a balance below zero.
      const spent = await tx.member.updateMany({
        where: { id: req.memberId, familyId: req.familyId, stars: { gte: reward.cost } },
        data:  { stars: { decrement: reward.cost } },
      });
      if (spent.count !== 1) return null;
      return tx.redemption.create({
        data: {
          familyId: req.familyId!,
          member:   { connect: { id: req.memberId! } },
          reward:   { connect: { id: reward.id } },
          approved: false,
          status:   'pending',
        },
        include: redemptionInclude,
      });
    });

    if (!result) {
      const member = await prisma.member.findUnique({ where: { id: req.memberId }, select: { stars: true } });
      return res.status(400).json({ error: `Need ${reward.cost} stars, you have ${member?.stars ?? 0}` });
    }

    broadcast(req.familyId!, { type: 'redemption:requested', redemption: result });
    await audit(req, 'reward.requested', `asked for "${reward.name}" (${reward.cost}⭐)`, { type: 'redemption', id: result.id });
    await notifyParents(
      req.familyId!,
      'Reward to approve',
      `${result.member.name} wants to redeem "${reward.name}" (${reward.cost}⭐)`,
      req.memberId,
    );
    res.json(result);
  } catch { res.status(400).json({ error: 'Could not redeem reward' }); }
});

// PATCH /api/rewards/redemptions/:id — parents approve or reject a pending request
router.patch('/redemptions/:id', async (req: AuthRequest, res) => {
  if (!requireParent(req, res)) return;
  try {
    const approved = req.body?.approved === true;
    const redemption = await prisma.redemption.findFirst({
      where: { id: req.params.id, familyId: req.familyId },
      include: { reward: true },
    });
    if (!redemption) return res.status(404).json({ error: 'Redemption not found' });

    // Only a pending request can be decided, and only once.
    const decided = await prisma.$transaction(async tx => {
      const claim = await tx.redemption.updateMany({
        where: { id: redemption.id, approved: false, status: 'pending' },
        data:  approved ? { approved: true, status: 'approved' } : { status: 'rejected' },
      });
      if (claim.count !== 1) return false;
      if (!approved) {
        await tx.member.update({ where: { id: redemption.memberId }, data: { stars: { increment: redemption.reward.cost } } });
        await tx.redemption.delete({ where: { id: redemption.id } });
      }
      return true;
    });
    if (!decided) return res.status(409).json({ error: 'This request has already been decided' });
    const who = await prisma.member.findUnique({ where: { id: redemption.memberId }, select: { name: true } });
    await audit(req, approved ? 'reward.approved' : 'reward.declined', `${approved ? 'approved' : 'declined'} ${who?.name}'s "${redemption.reward.name}"${approved ? '' : ' (stars refunded)'}`, { type: 'redemption', id: redemption.id });

    const updated = approved
      ? await prisma.redemption.findUnique({ where: { id: redemption.id }, include: redemptionInclude })
      : null;

    broadcast(req.familyId!, {
      type: approved ? 'redemption:approved' : 'redemption:rejected',
      redemption: updated,
      id: redemption.id,
    });

    if (approved) {
      await notifyMember(req.familyId!, redemption.memberId, 'Reward approved! 🎉', `Your "${redemption.reward.name}" reward was approved`);
    } else {
      await notifyMember(req.familyId!, redemption.memberId, 'Reward declined', `"${redemption.reward.name}" wasn't approved — your ${redemption.reward.cost}⭐ were refunded`);
    }

    res.json(updated ?? { ok: true, rejected: true });
  } catch { res.status(400).json({ error: 'Could not update request' }); }
});

export default router;
