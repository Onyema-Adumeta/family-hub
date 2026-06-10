"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
const db_1 = require("../db");
// ── GET all quests for family ─────────────────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const quests = await db_1.prisma.quest.findMany({
            where: { familyId: req.familyId },
            include: { member: { select: { id: true, name: true, emoji: true, color: true } } },
            orderBy: { createdAt: 'desc' },
        });
        res.json(quests);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// ── CREATE quest ──────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
    try {
        const { title, description, emoji, difficulty, stars, memberId, deadline, stages } = req.body;
        const quest = await db_1.prisma.quest.create({
            data: {
                familyId: req.familyId,
                title,
                description: description || null,
                emoji: emoji || '⚔️',
                difficulty: difficulty || 'easy',
                stars: stars || 10,
                reward: stars || 10, // keep reward in sync
                memberId: memberId || null,
                deadline: deadline ? new Date(deadline) : null,
                stages: stages || [],
            },
            include: { member: { select: { id: true, name: true, emoji: true, color: true } } },
        });
        res.json(quest);
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
// ── COMPLETE a quest (awards stars) ──────────────────────────────────────────
router.post('/:id/complete', async (req, res) => {
    try {
        const quest = await db_1.prisma.quest.findUnique({ where: { id: req.params.id } });
        if (!quest)
            return res.status(404).json({ error: 'Quest not found' });
        if (quest.completedAt)
            return res.status(400).json({ error: 'Quest already completed' });
        const starsToAward = quest.stars || quest.reward || 10;
        const targetMemberId = quest.memberId || req.memberId;
        const [updated] = await db_1.prisma.$transaction([
            db_1.prisma.quest.update({
                where: { id: req.params.id },
                data: { completedAt: new Date(), completed: true },
            }),
            db_1.prisma.member.update({
                where: { id: targetMemberId },
                data: {
                    stars: { increment: starsToAward },
                    totalChoresDone: { increment: 1 },
                },
            }),
        ]);
        res.json(updated);
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
// ── UPDATE stage progress ─────────────────────────────────────────────────────
router.patch('/:id/stages', async (req, res) => {
    try {
        const { stages } = req.body;
        const quest = await db_1.prisma.quest.update({
            where: { id: req.params.id },
            data: { stages },
            include: { member: { select: { id: true, name: true, emoji: true, color: true } } },
        });
        res.json(quest);
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
// ── UPDATE quest ──────────────────────────────────────────────────────────────
router.patch('/:id', async (req, res) => {
    try {
        const data = { ...req.body };
        if (data.deadline)
            data.deadline = new Date(data.deadline);
        if (data.stars)
            data.reward = data.stars; // keep in sync
        const quest = await db_1.prisma.quest.update({
            where: { id: req.params.id },
            data,
            include: { member: { select: { id: true, name: true, emoji: true, color: true } } },
        });
        res.json(quest);
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
// ── DELETE quest ──────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
    try {
        await db_1.prisma.quest.delete({ where: { id: req.params.id } });
        res.json({ ok: true });
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=quests.js.map