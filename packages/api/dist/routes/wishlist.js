"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get("/:memberId", auth_1.authMiddleware, async (req, res) => {
    try {
        const items = await db_1.prisma.wishlistItem.findMany({
            where: { memberId: req.params.memberId },
            orderBy: { createdAt: "desc" }
        });
        res.json(items);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.post("/:memberId", auth_1.authMiddleware, async (req, res) => {
    try {
        const { title, url, price } = req.body;
        const item = await db_1.prisma.wishlistItem.create({
            data: { memberId: req.params.memberId, title, url, price }
        });
        res.json(item);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.patch("/:id/claim", auth_1.authMiddleware, async (req, res) => {
    try {
        const item = await db_1.prisma.wishlistItem.update({
            where: { id: req.params.id },
            data: { claimed: true, claimedBy: req.memberId }
        });
        res.json(item);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.delete("/:id", auth_1.authMiddleware, async (req, res) => {
    try {
        await db_1.prisma.wishlistItem.delete({ where: { id: req.params.id } });
        res.json({ ok: true });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=wishlist.js.map