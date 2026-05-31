import { Router } from 'express';
import { AuthRequest } from '../middleware/auth';

const router = Router();
import { prisma } from '../db';

// GET /api/members — list all members in the family
router.get('/', async (req: AuthRequest, res) => {
  try {
    const members = await prisma.member.findMany({
      where: { familyId: req.familyId },
      orderBy: { createdAt: 'asc' },
    });
    res.json(members);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// PATCH /api/members/:id — update profile (name, emoji, color, avatar)
router.patch('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { name, emoji, color, avatar, pushToken } = req.body;

  // Members can only edit themselves; parents can edit anyone
  if (req.memberId !== id && req.role !== 'parent') {
    return res.status(403).json({ error: 'Not allowed' });
  }

  try {
    const updated = await prisma.member.update({
      where: { id },
      data: {
        ...(name      !== undefined && { name }),
        ...(emoji     !== undefined && { emoji }),
        ...(color     !== undefined && { color }),
        ...(avatar    !== undefined && { avatar }),
        ...(pushToken !== undefined && { pushToken }),
      },
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
  if (req.role !== 'parent') {
    return res.status(403).json({ error: 'Only parents can remove members' });
  }

  // Cannot remove yourself
  if (req.memberId === id) {
    return res.status(400).json({ error: 'You cannot remove yourself' });
  }

  // Target must be in same family
  const target = await prisma.member.findFirst({
    where: { id, familyId: req.familyId },
  });

  if (!target) {
    return res.status(404).json({ error: 'Member not found' });
  }

  try {
    await prisma.$transaction([
      // Unassign their chores
      prisma.chore.updateMany({
        where: { assignedToId: id, familyId: req.familyId },
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