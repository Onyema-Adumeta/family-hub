import { Router } from 'express';
import { PrismaClient, ChoreStatus } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { broadcast } from '../services/websocket';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

const router = Router();
import { prisma } from '../db';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:          'family-hub/chores',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'heic'],
  } as any,
});

const upload = multer({ storage });

// Standard include used on every chore response
const choreInclude = {
  assignedTo:  { select: { id: true, name: true, emoji: true, color: true, avatarUrl: true } },
  completedBy: { select: { id: true, name: true, emoji: true, color: true } },
  assignees:   { select: { id: true, name: true, emoji: true, color: true, avatarUrl: true } },
};

// Normalize assignee input: accept assigneeIds[] (new) or fall back to assignedToId (legacy single)
function resolveAssigneeIds(body: any): string[] {
  if (Array.isArray(body.assigneeIds)) {
    return body.assigneeIds.filter((x: any) => typeof x === 'string' && x.length > 0);
  }
  if (body.assignedToId) return [body.assignedToId];
  return [];
}

// GET /api/chores
router.get('/', async (req: AuthRequest, res) => {
  try {
    const chores = await prisma.chore.findMany({
      where: { familyId: req.familyId },
      include: choreInclude,
      orderBy: { createdAt: 'desc' },
    });
    res.json(chores);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/chores
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { title, emoji, frequency, stars, proofRequired, dueDate } = req.body;
    const assigneeIds = resolveAssigneeIds(req.body);

    const chore = await prisma.chore.create({
      data: {
        familyId:      req.familyId!,
        title,
        emoji:         emoji || '\u2705',
        frequency:     frequency || 'daily',
        stars:         stars ? parseInt(stars) : 5,
        proofRequired: proofRequired ?? false,
        // Mirror first assignee into assignedToId so legacy reads keep working
        assignedToId:  assigneeIds[0] || null,
        assignees:     assigneeIds.length ? { connect: assigneeIds.map(id => ({ id })) } : undefined,
        dueDate:       dueDate ? new Date(dueDate) : null,
        status:        ChoreStatus.pending,
      },
      include: choreInclude,
    });
    broadcast(req.familyId!, { type: 'chore:created', chore });
    res.json(chore);
  } catch (e: any) {
    console.error('POST /chores error:', e);
    res.status(400).json({ error: e.message });
  }
});

// PATCH /api/chores/:id
router.patch('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const {
      status, title, emoji, frequency,
      stars, proofRequired, proofUrl, proofType, dueDate,
    } = req.body;

    const existing = await prisma.chore.findUnique({
      where: { id },
      include: { assignees: { select: { id: true } } },
    });
    if (!existing) return res.status(404).json({ error: 'Chore not found' });

    const updateData: any = {};

    if (title         !== undefined) updateData.title         = title;
    if (emoji         !== undefined) updateData.emoji         = emoji;
    if (frequency     !== undefined) updateData.frequency     = frequency;
    if (stars         !== undefined) updateData.stars         = parseInt(stars);
    if (proofRequired !== undefined) updateData.proofRequired = proofRequired;
    if (proofUrl      !== undefined) updateData.proofUrl      = proofUrl;
    if (proofType     !== undefined) updateData.proofType     = proofType;
    if (dueDate       !== undefined) updateData.dueDate       = dueDate ? new Date(dueDate) : null;

    // Assignee changes: accept assigneeIds[] (preferred) or legacy assignedToId
    let newAssigneeIds: string[] | undefined;
    if (req.body.assigneeIds !== undefined || req.body.assignedToId !== undefined) {
      newAssigneeIds = resolveAssigneeIds(req.body);
      updateData.assignees    = { set: newAssigneeIds.map(aid => ({ id: aid })) };
      updateData.assignedToId = newAssigneeIds[0] || null; // keep mirror in sync
    }

    // The assignee list to use for streak/star logic (new list if changed, else existing)
    const effectiveAssigneeIds = newAssigneeIds ?? existing.assignees.map(a => a.id);

    if (status !== undefined) {
      const validStatuses = ['pending', 'in_progress', 'done'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status: ' + status });
      }

      updateData.status = status as ChoreStatus;

      if (status === 'done' && existing.status !== 'done') {
        updateData.completedAt   = new Date();
        updateData.completedById = req.memberId;

        // Split stars among assignees; completer gets remainder so nothing is lost.
        // No assignees -> full stars to whoever completed it.
        if (effectiveAssigneeIds.length > 0) {
          const base      = Math.floor(existing.stars / effectiveAssigneeIds.length);
          const remainder = existing.stars - base * effectiveAssigneeIds.length;
          for (const aid of effectiveAssigneeIds) {
            const share = base + (aid === req.memberId ? remainder : 0);
            if (share > 0) {
              await prisma.member.update({
                where: { id: aid },
                data:  { stars: { increment: share } },
              });
            }
          }
          // If the completer isn't one of the assignees, give them the remainder
          if (remainder > 0 && !effectiveAssigneeIds.includes(req.memberId!)) {
            await prisma.member.update({
              where: { id: req.memberId! },
              data:  { stars: { increment: remainder } },
            });
          }
        } else {
          await prisma.member.update({
            where: { id: req.memberId! },
            data:  { stars: { increment: existing.stars } },
          });
        }

        // Streak logic applies to all assignees
        const wasLate = existing.dueDate && new Date() > existing.dueDate;
        if (wasLate && effectiveAssigneeIds.length > 0) {
          for (const aid of effectiveAssigneeIds) {
            await prisma.member.update({ where: { id: aid }, data: { streakDays: 0 } });
            await prisma.notification.create({
              data: {
                familyId: req.familyId!,
                memberId: aid,
                title:    'Chore overdue!',
                body:     '"' + existing.title + '" was completed late - streak reset.',
              },
            });
          }
        } else if (effectiveAssigneeIds.length > 0) {
          for (const aid of effectiveAssigneeIds) {
            await prisma.member.update({
              where: { id: aid },
              data:  {
                streakDays:      { increment: 1 },
                streakUpdatedAt: new Date(),
                totalChoresDone: { increment: 1 },
              },
            });
          }
        }

        // Daily chores: save completed state, delete, recreate tomorrow's copy with same assignees
        if (existing.frequency === 'daily') {
          const completedChore = await prisma.chore.update({
            where: { id },
            data:  updateData,
            include: choreInclude,
          });
          broadcast(req.familyId!, { type: 'chore:updated', chore: completedChore });

          await prisma.chore.delete({ where: { id } });
          broadcast(req.familyId!, { type: 'chore:deleted', id });

          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(23, 59, 59, 0);

          const newChore = await prisma.chore.create({
            data: {
              familyId:      existing.familyId,
              title:         existing.title,
              emoji:         existing.emoji,
              frequency:     'daily',
              stars:         existing.stars,
              proofRequired: existing.proofRequired,
              assignedToId:  effectiveAssigneeIds[0] || null,
              assignees:     effectiveAssigneeIds.length ? { connect: effectiveAssigneeIds.map(aid => ({ id: aid })) } : undefined,
              dueDate:       tomorrow,
              status:        'pending',
            },
            include: choreInclude,
          });
          broadcast(req.familyId!, { type: 'chore:created', chore: newChore });

          return res.json(completedChore);
        }

      } else if (status === 'pending') {
        updateData.completedAt   = null;
        updateData.completedById = null;
      }
    }

    const chore = await prisma.chore.update({
      where: { id },
      data:  updateData,
      include: choreInclude,
    });

    broadcast(req.familyId!, { type: 'chore:updated', chore });
    res.json(chore);
  } catch (e: any) {
    console.error('PATCH /chores error:', e);
    res.status(400).json({ error: e.message });
  }
});

// PATCH /api/chores/:id/photo
router.patch('/:id/photo', upload.single('photo'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const photoUrl = (req.file as any).path;
    const chore = await prisma.chore.update({
      where: { id: req.params.id },
      data:  { photoUrl, photoedAt: new Date() },
      include: choreInclude,
    });
    broadcast(req.familyId!, { type: 'chore:updated', chore });
    res.json(chore);
  } catch (e: any) {
    console.error('PATCH /chores/:id/photo error:', e);
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/chores/:id
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    await prisma.chore.delete({ where: { id: req.params.id } });
    broadcast(req.familyId!, { type: 'chore:deleted', id: req.params.id });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// POST /api/chores/reset-daily (manual trigger, kept for admin use)
router.post('/reset-daily', async (req: AuthRequest, res) => {
  try {
    await prisma.chore.updateMany({
      where: { familyId: req.familyId, frequency: 'daily' },
      data:  { status: ChoreStatus.pending, completedAt: null, completedById: null, proofUrl: null },
    });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default router;