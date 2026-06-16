import { Router } from "express";
import { prisma } from "../db";
import { AuthRequest, authMiddleware } from "../middleware/auth";

const router = Router();

router.get("/:memberId", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const items = await prisma.wishlistItem.findMany({
      where: { memberId: req.params.memberId },
      orderBy: { createdAt: "desc" }
    });
    res.json(items);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/:memberId", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { title, url, price } = req.body;
    const item = await prisma.wishlistItem.create({
      data: { memberId: req.params.memberId, title, url, price }
    });
    res.json(item);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Edit an existing wish (title / url / price). Owner of the wish or a parent only.
router.patch("/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.wishlistItem.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Wish not found" });

    const isOwner = existing.memberId === req.memberId;
    if (!isOwner && req.role !== 'parent') {
      return res.status(403).json({ error: "Not allowed to edit this wish" });
    }

    const { title, url, price } = req.body;
    const data: any = {};
    if (title !== undefined) data.title = title;
    if (url !== undefined) data.url = url;
    if (price !== undefined) data.price = price;

    const item = await prisma.wishlistItem.update({
      where: { id: req.params.id },
      data,
    });
    res.json(item);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch("/:id/claim", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const item = await prisma.wishlistItem.update({
      where: { id: req.params.id },
      data: { claimed: true, claimedBy: req.memberId }
    });
    res.json(item);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Parent review: approve
router.patch("/:id/approve", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (req.role !== 'parent') return res.status(403).json({ error: "Parents only" });
    const item = await prisma.wishlistItem.update({
      where: { id: req.params.id },
      data: { status: "approved", declineReason: null, deferUntil: null, reviewedBy: req.memberId, reviewedAt: new Date() }
    });
    res.json(item);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Parent review: decline (with reason)
router.patch("/:id/decline", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (req.role !== 'parent') return res.status(403).json({ error: "Parents only" });
    const { reason } = req.body;
    const item = await prisma.wishlistItem.update({
      where: { id: req.params.id },
      data: { status: "declined", declineReason: reason || null, deferUntil: null, reviewedBy: req.memberId, reviewedAt: new Date() }
    });
    res.json(item);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Parent review: defer / maybe later (with reason + optional date)
router.patch("/:id/defer", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (req.role !== 'parent') return res.status(403).json({ error: "Parents only" });
    const { reason, deferUntil } = req.body;
    const item = await prisma.wishlistItem.update({
      where: { id: req.params.id },
      data: { status: "deferred", declineReason: reason || null, deferUntil: deferUntil ? new Date(deferUntil) : null, reviewedBy: req.memberId, reviewedAt: new Date() }
    });
    res.json(item);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    await prisma.wishlistItem.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;