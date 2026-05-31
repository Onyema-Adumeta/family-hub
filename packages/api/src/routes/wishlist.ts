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

router.patch("/:id/claim", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const item = await prisma.wishlistItem.update({
      where: { id: req.params.id },
      data: { claimed: true, claimedBy: req.memberId }
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
