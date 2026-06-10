"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const express_1 = require("express");
const websocket_1 = require("../services/websocket");
const router = (0, express_1.Router)();
const db_1 = require("../db");
// GET /api/grocery
router.get('/', async (req, res) => {
    try {
        const items = await db_1.prisma.groceryItem.findMany({
            where: { familyId: req.familyId },
            include: { addedBy: { select: { id: true, name: true, emoji: true, color: true } } },
            orderBy: [{ checked: 'asc' }, { createdAt: 'desc' }],
        });
        res.json(items);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// POST /api/grocery
router.post('/', async (req, res) => {
    try {
        const { name, qty, category, listType, priority, notes } = req.body;
        if (!name?.trim())
            return res.status(400).json({ error: 'name is required' });
        const item = await db_1.prisma.groceryItem.create({
            data: {
                familyId: req.familyId,
                addedById: req.memberId,
                name: name.trim(),
                qty: qty || null,
                category: category || 'General',
                listType: listType || 'grocery', // ÃƒÂ¢Ã¢â‚¬Â Ã‚Â key field
                priority: priority || 'normal',
                notes: notes || null,
            },
            include: { addedBy: { select: { id: true, name: true, emoji: true, color: true } } },
        });
        (0, websocket_1.broadcast)(req.familyId, { type: 'grocery:added', item });
        res.json(item);
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
// PATCH /api/grocery/:id
router.patch('/:id', async (req, res) => {
    try {
        const item = await db_1.prisma.groceryItem.update({
            where: { id: req.params.id },
            data: req.body,
            include: { addedBy: { select: { id: true, name: true, emoji: true, color: true } } },
        });
        (0, websocket_1.broadcast)(req.familyId, { type: 'grocery:updated', item });
        res.json(item);
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
// DELETE /api/grocery/:id
router.delete('/:id', async (req, res) => {
    try {
        await db_1.prisma.groceryItem.delete({ where: { id: req.params.id } });
        (0, websocket_1.broadcast)(req.familyId, { type: 'grocery:deleted', id: req.params.id });
        res.json({ ok: true });
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
// DELETE /api/grocery/checked/all
router.delete('/checked/all', async (req, res) => {
    try {
        const { count } = await db_1.prisma.groceryItem.deleteMany({
            where: { familyId: req.familyId, checked: true },
        });
        (0, websocket_1.broadcast)(req.familyId, { type: 'grocery:cleared', count });
        res.json({ ok: true, count });
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
const anthropic = new sdk_1.default({ apiKey: process.env.ANTHROPIC_API_KEY });
// POST /api/grocery/suggest
router.post('/suggest', async (req, res) => {
    try {
        const { week } = req.body;
        // Get this week's meals
        const meals = await db_1.prisma.meal.findMany({
            where: { familyId: req.familyId, ...(week ? { week } : {}) },
            orderBy: { createdAt: 'asc' },
        });
        if (meals.length === 0) {
            return res.json({ suggestions: [], message: 'No meals planned this week.' });
        }
        // Get existing grocery items to avoid duplicates
        const existing = await db_1.prisma.groceryItem.findMany({
            where: { familyId: req.familyId, checked: false },
            select: { name: true },
        });
        const existingNames = existing.map(i => i.name.toLowerCase());
        const mealList = meals.map(m => `${m.day} ${m.slot}: ${m.name}${m.notes ? ` (${m.notes})` : ''}`).join('\n');
        const existingList = existingNames.length > 0 ? `\nAlready on list: ${existingNames.join(', ')}` : '';
        const prompt = `You are a helpful family meal planning assistant. Based on these planned meals, suggest the grocery items needed.

Meals this week:
${mealList}
${existingList}

Return ONLY a JSON array of grocery suggestions. Do not include items already on the list. Group by category. Format:
[
  { "name": "item name", "qty": "amount", "category": "Produce|Meat|Dairy|Pantry|Frozen|Bakery|Beverages|Other" },
  ...
]

Be practical and specific. Include quantities where helpful (e.g. "2 lbs", "1 dozen"). No markdown, no explanation, just the JSON array.`;
        const response = await anthropic.messages.create({
            model: 'claude-opus-4-5',
            max_tokens: 1000,
            messages: [{ role: 'user', content: prompt }],
        });
        const text = response.content[0].type === 'text' ? response.content[0].text : '[]';
        const suggestions = JSON.parse(text.replace(/```json|```/g, '').trim());
        res.json({ suggestions, mealCount: meals.length });
    }
    catch (e) {
        console.error('Grocery suggest error:', e);
        res.status(500).json({ error: e.message });
    }
});
// POST /api/grocery/suggest â€” AI suggestions from meal plan
router.post('/suggest', async (req, res) => {
    try {
        const anthropic = new sdk_1.default({ apiKey: process.env.ANTHROPIC_API_KEY });
        const { week } = req.body;
        const meals = await db_1.prisma.meal.findMany({
            where: { familyId: req.familyId, ...(week ? { week } : {}) },
            orderBy: { createdAt: 'asc' },
        });
        if (meals.length === 0)
            return res.json({ suggestions: [], message: 'No meals planned this week.' });
        const existing = await db_1.prisma.groceryItem.findMany({
            where: { familyId: req.familyId, checked: false },
            select: { name: true },
        });
        const existingNames = existing.map(i => i.name.toLowerCase());
        const mealList = meals.map(m => `${m.day} ${m.slot}: ${m.name}${m.notes ? ` (${m.notes})` : ''}`).join('\n');
        const existingList = existingNames.length > 0 ? `\nAlready on list: ${existingNames.join(', ')}` : '';
        const prompt = `You are a helpful family meal planning assistant. Based on these planned meals, suggest the grocery items needed.\n\nMeals this week:\n${mealList}${existingList}\n\nReturn ONLY a JSON array. Do not include items already on the list. Format:\n[\n  { "name": "item name", "qty": "amount", "category": "Produce|Meat & Fish|Dairy|Pantry|Frozen|Bakery|Drinks|Snacks|Household|Other" }\n]\n\nBe practical and specific. Include quantities where helpful. No markdown, no explanation, just the JSON array.`;
        const response = await anthropic.messages.create({
            model: 'claude-opus-4-5',
            max_tokens: 1000,
            messages: [{ role: 'user', content: prompt }],
        });
        const text = response.content[0].type === 'text' ? response.content[0].text : '[]';
        const suggestions = JSON.parse(text.replace(/```json|```/g, '').trim());
        res.json({ suggestions, mealCount: meals.length });
    }
    catch (e) {
        console.error('Grocery suggest error:', e);
        res.status(500).json({ error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=grocery.js.map