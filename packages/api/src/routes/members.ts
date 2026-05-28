import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/members — list all members in the family
router.get('/', async (req: AuthRequest, res) => {
  try {
    const members = await prisma.member.findMany({
      where: { familyId: req.member!.familyId },
      orderBy: { createdAt: 'asc' },
    });
    res.json(members);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// PATCH /api/members/:id — update own profile (name, emoji, color)
router.patch('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { name, emoji, color, avatar } = req.body;

  // Members can only edit themselves (parents can edit anyone)
  if (req.member!.id !== id && req.member!.role !== 'parent') {
    return res.status(403).json({ error: 'Not allowed' });
  }

  try {
    const updated = await prisma.member.update({
      where: { id },
      data: { ...(name && { name }), ...(emoji && { emoji }), ...(color && { color }), ...(avatar !== undefined && { avatar }) },
    });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update member' });
  }
});

// DELETE /api/members/:id — parent only, cannot remove yourself
router.delete('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;

  // Must be a parent
  if (req.member!.role !== 'parent') {
    return res.status(403).json({ error: 'Only parents can remove members' });
  }

  // Cannot remove yourself
  if (req.member!.id === id) {
    return res.status(400).json({ error: 'You cannot remove yourself' });
  }

  // Target must be in same family
  const target = await prisma.member.findFirst({
    where: { id, familyId: req.member!.familyId },
  });

  if (!target) {
    return res.status(404).json({ error: 'Member not found' });
  }

  try {
    // Reassign or delete their chores, then remove the member
    await prisma.$transaction([
      // Unassign their chores (set assignedTo null)
      prisma.chore.updateMany({
        where: { assignedToId: id, familyId: req.member!.familyId },
        data: { assignedToId: null },
      }),
      // Delete their chat messages
      prisma.message.deleteMany({ where: { memberId: id } }),
      // Delete the member
      prisma.member.delete({ where: { id } }),
    ]);

    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

export default router;