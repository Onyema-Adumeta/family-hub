"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const websocket_1 = require("../services/websocket");
const router = (0, express_1.Router)();
const db_1 = require("../db");
router.get('/', async (req, res) => {
    const messages = await db_1.prisma.message.findMany({ where: { familyId: req.familyId }, include: { member: true }, orderBy: { createdAt: 'asc' }, take: 100 });
    res.json(messages);
});
router.post('/', async (req, res) => {
    try {
        const message = await db_1.prisma.message.create({ data: { familyId: req.familyId, memberId: req.memberId, ...req.body }, include: { member: true } });
        (0, websocket_1.broadcast)(req.familyId, { type: 'message:new', message });
        res.json(message);
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
router.patch('/:id/pin', async (req, res) => {
    const message = await db_1.prisma.message.update({ where: { id: req.params.id }, data: { pinned: true } });
    res.json(message);
});
router.delete('/:id', async (req, res) => {
    await db_1.prisma.message.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
});
exports.default = router;
//# sourceMappingURL=chat.js.map