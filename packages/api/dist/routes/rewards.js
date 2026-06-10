"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const websocket_1 = require("../services/websocket");
const router = (0, express_1.Router)();
const db_1 = require("../db");
// GET /api/rewards
router.get('/', async (req, res) => {
    try {
        const rewards = await db_1.prisma.reward.findMany({
            where: { familyId: req.familyId },
            orderBy: { cost: 'asc' }, // ← schema field is 'cost'
        });
        res.json(rewards);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// POST /api/rewards
router.post('/', async (req, res) => {
    try {
        const { title, name, emoji, starCost, cost, description } = req.body;
        const rewardName = (title || name || '').trim();
        const rewardCost = Number(starCost || cost) || 10;
        if (!rewardName)
            return res.status(400).json({ error: 'name is required' });
        const reward = await db_1.prisma.reward.create({
            data: {
                familyId: req.familyId,
                name: rewardName, // ← schema field is 'name'
                emoji: emoji || '🎁',
                cost: rewardCost, // ← schema field is 'cost'
                description: description || null,
            },
        });
        (0, websocket_1.broadcast)(req.familyId, { type: 'reward:created', reward });
        res.json(reward);
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
// DELETE /api/rewards/:id
router.delete('/:id', async (req, res) => {
    try {
        await db_1.prisma.reward.delete({ where: { id: req.params.id } });
        (0, websocket_1.broadcast)(req.familyId, { type: 'reward:deleted', id: req.params.id });
        res.json({ ok: true });
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
// GET /api/rewards/redemptions
router.get('/redemptions', async (req, res) => {
    try {
        const redemptions = await db_1.prisma.redemption.findMany({
            where: { member: { familyId: req.familyId } },
            include: {
                reward: true,
                member: { select: { id: true, name: true, emoji: true, color: true, avatarUrl: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json(redemptions);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// POST /api/rewards/redeem/:rewardId — child requests a reward
router.post('/redeem/:rewardId', async (req, res) => {
    try {
        const reward = await db_1.prisma.reward.findUnique({ where: { id: req.params.rewardId } });
        if (!reward)
            return res.status(404).json({ error: 'Reward not found' });
        const member = await db_1.prisma.member.findUnique({ where: { id: req.memberId } });
        if (!member)
            return res.status(404).json({ error: 'Member not found' });
        if ((member.stars ?? 0) < reward.cost) {
            return res.status(400).json({ error: `Need ${reward.cost} stars, you have ${member.stars}` });
        }
        // Create redemption — approved:false means "pending parent approval"
        const redemption = await db_1.prisma.redemption.create({
            data: {
                familyId: req.familyId,
                member: { connect: { id: req.memberId } },
                reward: { connect: { id: reward.id } },
                approved: false,
            },
            include: {
                reward: true,
                member: { select: { id: true, name: true, emoji: true } },
            },
        });
        // Deduct stars immediately (refunded on rejection)
        await db_1.prisma.member.update({
            where: { id: req.memberId },
            data: { stars: { decrement: reward.cost } },
        });
        (0, websocket_1.broadcast)(req.familyId, { type: 'redemption:requested', redemption });
        res.json(redemption);
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
// PATCH /api/rewards/redemptions/:id — parent approves or rejects
router.patch('/redemptions/:id', async (req, res) => {
    try {
        const { approved } = req.body;
        const redemption = await db_1.prisma.redemption.findUnique({
            where: { id: req.params.id },
            include: { reward: true },
        });
        if (!redemption)
            return res.status(404).json({ error: 'Redemption not found' });
        if (approved) {
            // Approve — stars already deducted, just mark approved
            await db_1.prisma.redemption.update({
                where: { id: redemption.id },
                data: { approved: true },
            });
        }
        else {
            // Reject — refund the stars, delete the redemption
            await db_1.prisma.member.update({
                where: { id: redemption.memberId },
                data: { stars: { increment: redemption.reward.cost } },
            });
            await db_1.prisma.redemption.delete({ where: { id: redemption.id } });
        }
        const updated = approved
            ? await db_1.prisma.redemption.findUnique({
                where: { id: redemption.id },
                include: {
                    reward: true,
                    member: { select: { id: true, name: true, emoji: true } },
                },
            })
            : null;
        (0, websocket_1.broadcast)(req.familyId, {
            type: approved ? 'redemption:approved' : 'redemption:rejected',
            redemption: updated,
            id: redemption.id,
        });
        res.json(updated ?? { ok: true, rejected: true });
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=rewards.js.map