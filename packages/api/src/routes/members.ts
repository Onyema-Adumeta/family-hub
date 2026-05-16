import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();
const prisma = new PrismaClient();

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `avatar-${req.params.id}-${Date.now()}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

const MEMBER_SELECT = {
  id: true, name: true, emoji: true, color: true,
  role: true, stars: true, avatarUrl: true, createdAt: true
};

router.get('/', async (req: AuthRequest, res) => {
  const members = await prisma.member.findMany({
    where: { familyId: req.familyId },
    select: MEMBER_SELECT
  });
  res.json(members);
});

router.patch('/:id', async (req: AuthRequest, res) => {
  const { name, emoji, color, pushToken } = req.body;
  const member = await prisma.member.update({
    where: { id: req.params.id },
    data: { name, emoji, color, pushToken },
    select: MEMBER_SELECT
  });
  res.json(member);
});

router.post('/:id/avatar', upload.single('avatar'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    // Delete old avatar file if it exists
    const existing = await prisma.member.findUnique({
      where: { id: req.params.id },
      select: { avatarUrl: true }
    });
    if (existing?.avatarUrl) {
      const oldPath = path.join(__dirname, '../../', existing.avatarUrl);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const avatarUrl = `/uploads/${req.file.filename}`;
    const member = await prisma.member.update({
      where: { id: req.params.id },
      data: { avatarUrl },
      select: MEMBER_SELECT
    });
    res.json(member);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;