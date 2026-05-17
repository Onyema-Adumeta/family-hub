import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { broadcast } from '../services/websocket';

const router = Router();
const prisma = new PrismaClient();

// GET /api/grocery — list all items for this family
router.get('/', async (req: AuthRequest, res) => {
  try {
    const items = await prisma.groceryItem.findMany({
      where: { familyId: req.familyId },
      include: { addedBy: { select: { id: true, name: true, emoji: true, color: true } } },
      orderBy: [{ checked: 'asc' }, { createdAt: 'desc' }],
    });
    res.json(items);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/grocery — add item
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { name, qty, category } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
    const item = await prisma.groceryItem.create({
      data: {
        familyId: req.familyId!,
        addedById: req.memberId!,
        name: name.trim(),
        qty: qty || null,
        category: category || 'General',
      },
      include: { addedBy: { select: { id: true, name: true, emoji: true, color: true } } },
    });
    broadcast(req.familyId!, { type: 'grocery:added', item });
    res.json(item);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// PATCH /api/grocery/:id — toggle checked or update
router.patch('/:id', async (req: AuthRequest, res) => {
  try {
    const item = await prisma.groceryItem.update({
      where: { id: req.params.id },
      data: req.body,
      include: { addedBy: { select: { id: true, name: true, emoji: true, color: true } } },
    });
    broadcast(req.familyId!, { type: 'grocery:updated', item });
    res.json(item);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// DELETE /api/grocery/:id — remove item
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    await prisma.groceryItem.delete({ where: { id: req.params.id } });
    broadcast(req.familyId!, { type: 'grocery:deleted', id: req.params.id });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// DELETE /api/grocery/checked/all — clear all checked items
router.delete('/checked/all', async (req: AuthRequest, res) => {
  try {
    const { count } = await prisma.groceryItem.deleteMany({
      where: { familyId: req.familyId, checked: true },
    });
    broadcast(req.familyId!, { type: 'grocery:cleared', count });
    res.json({ ok: true, count });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
