import { Router } from 'express';
import { prisma } from '../db';
import { authenticate } from '../middleware/auth';

const router = Router();

// GET /api/wishlist/:memberId
router.get('/:memberId', authenticate, async (req, res) => {
  const items = await prisma.wishlistItem.findMany({
    where: { memberId: req.params.memberId },
    orderBy: { createdAt: 'desc' }
  });
  res.json(items);
});

// POST /api/wishlist/:memberId
router.post('/:memberId', authenticate, async (req, res) => {
  const { title, url, price } = req.body;
  const item = await prisma.wishlistItem.create({
    data: { memberId: req.params.memberId, title, url, price }
  });
  res.json(item);
});

// PATCH /api/wishlist/:id/claim
router.patch('/:id/claim', authenticate, async (req, res) => {
  const item = await prisma.wishlistItem.update({
    where: { id: req.params.id },
    data: { claimed: true, claimedBy: req.user.memberId }
  });
  res.json(item);
});

// DELETE /api/wishlist/:id
router.delete('/:id', authenticate, async (req, res) => {
  await prisma.wishlistItem.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

export default router;