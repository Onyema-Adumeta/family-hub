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

// GET /api/chores
router.get('/', async (req: AuthRequest, res) => {
  try {
    const chores = await prisma.chore.findMany({
      where: { familyId: req.familyId },
      include: {
        assignedTo:  { select: { id: true, name: true, emoji: true, color: true, avatarUrl: true } },
        completedBy: { select: { id: true, name: true, emoji: true, color: true } },
      },
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
    const { title, emoji, frequency, stars, proofRequired, assignedToId, dueDate } = req.body;
    const chore = await prisma.chore.create({
      data: {
        familyId:      req.familyId!,
        title,
        emoji:         emoji || '?',
        frequency:     frequency || 'daily',
        stars:         stars ? parseInt(stars) : 5,
        proofRequired: proofRequired ?? false,
        assignedToId:  assignedToId || null,
        dueDate:       dueDate ? new Date(dueDate) : null,
        status:        ChoreStatus.pending,
      },
      include: {
        assignedTo:  { select: { id: true, name: true, emoji: true, color: true, avatarUrl: true } },
        completedBy: { select: { id: true, name: true, emoji: true, color: true } },
      },
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
      status, assignedToId, title, emoji, frequency,
      stars, proofRequired, proofUrl, proofType, dueDate,
    } = req.body;

    const existing = await prisma.chore.findUnique({ where: { id } });
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
    if (assignedToId  !== undefined) updateData.assignedToId  = assignedToId || null;

    if (status !== undefined) {
      const validStatuses = ['pending', 'in_progress', 'done'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status: ' + status });
      }

      updateData.status = status as ChoreStatus;

      if (status === 'done' && existing.status !== 'done') {
        updateData.completedAt   = new Date();
        updateData.completedById = req.memberId;

        // Award stars to whoever completed it
        await prisma.member.update({
          where: { id: req.memberId! },
          data:  { stars: { increment: existing.stars } },
        });

        // Streak logic
        if (existing.dueDate && new Date() > existing.dueDate && existing.assignedToId) {
          await prisma.member.update({
            where: { id: existing.assignedToId },
            data:  { streakDays: 0 },
          });
          await prisma.notification.create({
            data: {
              familyId: req.familyId!,
              memberId: existing.assignedToId,
              title:    'Chore overdue!',
              body:     '"' + existing.title + '" was completed late - streak reset.',
            },
          });
        } else if (existing.assignedToId) {
          await prisma.member.update({
            where: { id: existing.assignedToId },
            data:  {
              streakDays:      { increment: 1 },
              streakUpdatedAt: new Date(),
              totalChoresDone: { increment: 1 },
            },
          });
        }

        // For daily chores: save details, delete this record, create tomorrow's copy
        if (existing.frequency === 'daily') {
          // First finish saving the completed state so the UI sees it briefly
          const completedChore = await prisma.chore.update({
            where: { id },
            data:  updateData,
            include: {
              assignedTo:  { select: { id: true, name: true, emoji: true, color: true, avatarUrl: true } },
              completedBy: { select: { id: true, name: true, emoji: true, color: true } },
            },
          });

          broadcast(req.familyId!, { type: 'chore:updated', chore: completedChore });

          // Delete the completed chore
          await prisma.chore.delete({ where: { id } });
          broadcast(req.familyId!, { type: 'chore:deleted', id });

          // Create fresh copy due tomorrow
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
              assignedToId:  existing.assignedToId,
              dueDate:       tomorrow,
              status:        'pending',
            },
            include: {
              assignedTo:  { select: { id: true, name: true, emoji: true, color: true, avatarUrl: true } },
              completedBy: { select: { id: true, name: true, emoji: true, color: true } },
            },
          });

          broadcast(req.familyId!, { type: 'chore:created', chore: newChore });

          // Return the completed chore so the UI can show the done state momentarily
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
      include: {
        assignedTo:  { select: { id: true, name: true, emoji: true, color: true, avatarUrl: true } },
        completedBy: { select: { id: true, name: true, emoji: true, color: true } },
      },
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
      include: {
        assignedTo:  { select: { id: true, name: true, emoji: true, color: true, avatarUrl: true } },
        completedBy: { select: { id: true, name: true, emoji: true, color: true } },
      },
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