"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
const db_1 = require("../db");
// GET /api/members — list all members in the family
router.get('/', async (req, res) => {
    try {
        const members = await db_1.prisma.member.findMany({
            where: { familyId: req.familyId },
            orderBy: { createdAt: 'asc' },
        });
        res.json(members);
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to fetch members' });
    }
});
// PATCH /api/members/:id — update profile (name, emoji, color, avatar)
router.patch('/:id', async (req, res) => {
    const { id } = req.params;
    const { name, emoji, color, avatar, pushToken, birthday } = req.body;
    // Members can only edit themselves; parents can edit anyone
    if (req.memberId !== id && req.role !== 'parent') {
        return res.status(403).json({ error: 'Not allowed' });
    }
    try {
        const updated = await db_1.prisma.member.update({
            where: { id },
            data: {
                ...(name !== undefined && { name }),
                ...(emoji !== undefined && { emoji }),
                ...(color !== undefined && { color }),
                ...(avatar !== undefined && { avatar }),
                ...(pushToken !== undefined && { pushToken }),
                ...(birthday !== undefined && { birthday: birthday ? new Date(birthday) : null }),
            },
        });
        res.json(updated);
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to update member' });
    }
});
// DELETE /api/members/:id — parent only, cannot remove yourself
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    // Must be a parent
    if (req.role !== 'parent') {
        return res.status(403).json({ error: 'Only parents can remove members' });
    }
    // Cannot remove yourself
    if (req.memberId === id) {
        return res.status(400).json({ error: 'You cannot remove yourself' });
    }
    // Target must be in same family
    const target = await db_1.prisma.member.findFirst({
        where: { id, familyId: req.familyId },
    });
    if (!target) {
        return res.status(404).json({ error: 'Member not found' });
    }
    try {
        await db_1.prisma.$transaction([
            // Unassign their chores
            db_1.prisma.chore.updateMany({
                where: { assignedToId: id, familyId: req.familyId },
                data: { assignedToId: null },
            }),
            // Delete their chat messages
            db_1.prisma.message.deleteMany({ where: { memberId: id } }),
            // Delete the member
            db_1.prisma.member.delete({ where: { id } }),
        ]);
        res.json({ success: true });
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to remove member' });
    }
});
exports.default = router;
//# sourceMappingURL=members.js.map