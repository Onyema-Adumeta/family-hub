"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
const db_1 = require("../db");
router.get('/', async (req, res) => {
    const { week } = req.query;
    const meals = await db_1.prisma.meal.findMany({
        where: { familyId: req.familyId, ...(week ? { week: week } : {}) },
        include: { assignedTo: true },
        orderBy: { createdAt: 'asc' }
    });
    res.json(meals);
});
router.post('/', async (req, res) => {
    try {
        const meal = await db_1.prisma.meal.create({ data: { familyId: req.familyId, ...req.body }, include: { assignedTo: true } });
        res.json(meal);
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
router.patch('/:id', async (req, res) => {
    try {
        const meal = await db_1.prisma.meal.update({ where: { id: req.params.id }, data: req.body, include: { assignedTo: true } });
        res.json(meal);
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
router.delete('/:id', async (req, res) => {
    await db_1.prisma.meal.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
});
exports.default = router;
//# sourceMappingURL=meals.js.map