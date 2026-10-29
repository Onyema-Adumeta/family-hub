import { Router } from "express";
import { prisma } from "../db";
import { audit } from "../services/audit";
import { AuthRequest } from "../middleware/auth";
import { notifyParents } from "../services/notify";
import { memberInFamily, requireParent } from "../lib/guards";

const router = Router();

// Loads a wish only if its owner is in the caller's family.
function findFamilyWish(id: string, familyId: string) {
  return prisma.wishlistItem.findFirst({ where: { id, member: { familyId } } });
}

function cleanPrice(price: any) {
  if (price === undefined || price === null || price === "") return null;
  const n = Number(price);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

router.get("/:memberId", async (req: AuthRequest, res) => {
  try {
    if (!(await memberInFamily(req.params.memberId, req.familyId!))) return res.status(404).json({ error: "Member not found" });
    const items = await prisma.wishlistItem.findMany({
      where: { memberId: req.params.memberId },
      orderBy: { createdAt: "desc" },
    });
    res.json(items);
  } catch { res.status(500).json({ error: "Could not load wishlist" }); }
});

// Add to your own list; parents may add to anyone's list in the family.
router.post("/:memberId", async (req: AuthRequest, res) => {
  try {
    const ownerId = req.params.memberId;
    if (ownerId !== req.memberId && req.role !== "parent") return res.status(403).json({ error: "You can only add to your own wishlist" });
    const owner = await prisma.member.findFirst({ where: { id: ownerId, familyId: req.familyId }, select: { familyId: true, name: true } });
    if (!owner) return res.status(404).json({ error: "Member not found" });

    const { title, url, price } = req.body || {};
    if (typeof title !== "string" || !title.trim() || title.length > 200) return res.status(400).json({ error: "title is required" });
    if (url !== undefined && url !== null && url !== "" && (typeof url !== "string" || !/^https?:\/\//i.test(url))) return res.status(400).json({ error: "Invalid link" });
    const priceValue = cleanPrice(price);
    if (priceValue === undefined) return res.status(400).json({ error: "Invalid price" });

    const item = await prisma.wishlistItem.create({
      data: { memberId: ownerId, title: title.trim(), url: url || null, price: priceValue },
    });

    await notifyParents(owner.familyId, "New wishlist item", `${owner.name} added "${item.title}" to their wishlist`, ownerId);
    res.json(item);
  } catch { res.status(500).json({ error: "Could not add wish" }); }
});

// Edit an existing wish (title / url / price). Owner of the wish or a parent only.
router.patch("/:id", async (req: AuthRequest, res) => {
  try {
    const existing = await findFamilyWish(req.params.id, req.familyId!);
    if (!existing) return res.status(404).json({ error: "Wish not found" });
    if (existing.memberId !== req.memberId && req.role !== "parent") return res.status(403).json({ error: "Not allowed to edit this wish" });

    const { title, url, price } = req.body || {};
    const data: any = {};
    if (title !== undefined) {
      if (typeof title !== "string" || !title.trim()) return res.status(400).json({ error: "Invalid title" });
      data.title = title.trim();
    }
    if (url !== undefined) data.url = url || null;
    if (price !== undefined) {
      const p = cleanPrice(price);
      if (p === undefined) return res.status(400).json({ error: "Invalid price" });
      data.price = p;
    }
    const item = await prisma.wishlistItem.update({ where: { id: existing.id }, data });
    res.json(item);
  } catch { res.status(500).json({ error: "Could not update wish" }); }
});

// Someone else in the family claims a wish (e.g. to buy it as a gift).
router.patch("/:id/claim", async (req: AuthRequest, res) => {
  try {
    const existing = await findFamilyWish(req.params.id, req.familyId!);
    if (!existing) return res.status(404).json({ error: "Wish not found" });
    if (existing.memberId === req.memberId) return res.status(400).json({ error: "You can't claim your own wish" });
    const item = await prisma.wishlistItem.update({ where: { id: existing.id }, data: { claimed: true, claimedBy: req.memberId } });
    res.json(item);
  } catch { res.status(500).json({ error: "Could not claim wish" }); }
});

// Parent review: approve / decline / defer
router.patch("/:id/approve", async (req: AuthRequest, res) => {
  if (!requireParent(req, res)) return;
  try {
    const existing = await findFamilyWish(req.params.id, req.familyId!);
    if (!existing) return res.status(404).json({ error: "Wish not found" });
    const item = await prisma.wishlistItem.update({
      where: { id: existing.id },
      data: { status: "approved", declineReason: null, deferUntil: null, reviewedBy: req.memberId, reviewedAt: new Date() },
    });
    await audit(req, "wish.approved", `approved wish "${item.title}"`, { type: "wish", id: item.id });
    res.json(item);
  } catch { res.status(500).json({ error: "Could not approve wish" }); }
});

router.patch("/:id/decline", async (req: AuthRequest, res) => {
  if (!requireParent(req, res)) return;
  try {
    const existing = await findFamilyWish(req.params.id, req.familyId!);
    if (!existing) return res.status(404).json({ error: "Wish not found" });
    const { reason } = req.body || {};
    const item = await prisma.wishlistItem.update({
      where: { id: existing.id },
      data: { status: "declined", declineReason: reason || null, deferUntil: null, reviewedBy: req.memberId, reviewedAt: new Date() },
    });
    await audit(req, "wish.declined", `declined wish "${item.title}"`, { type: "wish", id: item.id });
    res.json(item);
  } catch { res.status(500).json({ error: "Could not decline wish" }); }
});

router.patch("/:id/defer", async (req: AuthRequest, res) => {
  if (!requireParent(req, res)) return;
  try {
    const existing = await findFamilyWish(req.params.id, req.familyId!);
    if (!existing) return res.status(404).json({ error: "Wish not found" });
    const { reason, deferUntil } = req.body || {};
    const item = await prisma.wishlistItem.update({
      where: { id: existing.id },
      data: { status: "deferred", declineReason: reason || null, deferUntil: deferUntil ? new Date(deferUntil) : null, reviewedBy: req.memberId, reviewedAt: new Date() },
    });
    res.json(item);
  } catch { res.status(500).json({ error: "Could not defer wish" }); }
});

router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const existing = await findFamilyWish(req.params.id, req.familyId!);
    if (!existing) return res.status(404).json({ error: "Wish not found" });
    if (existing.memberId !== req.memberId && req.role !== "parent") return res.status(403).json({ error: "Not allowed to delete this wish" });
    await prisma.wishlistItem.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "Could not delete wish" }); }
});

export default router;
