import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

function makeInviteCode() {
  return 'FAM-' + Math.random().toString(36).substring(2, 6).toUpperCase();
}

function makeToken(memberId: string, familyId: string, role: string) {
  return jwt.sign({ memberId, familyId, role }, process.env.JWT_SECRET!, { expiresIn: '30d' });
}

const MEMBER_SELECT = {
  id: true, name: true, emoji: true, color: true,
  role: true, stars: true, avatarUrl: true, email: true, createdAt: true
};

// Register — creates a new family + parent member
router.post('/register', async (req, res) => {
  try {
    const { familyName, name, emoji, color, password, email } = req.body;
    const hash = await bcrypt.hash(password, 10);
    const family = await prisma.family.create({
      data: {
        name: familyName,
        inviteCode: makeInviteCode(),
        members: {
          create: {
            name, emoji: emoji || '👨', color: color || '#6366F1',
            role: 'parent', password: hash, email, stars: 0
          }
        }
      },
      include: { members: { select: MEMBER_SELECT } }
    });
    const member = family.members[0];
    res.json({ token: makeToken(member.id, family.id, member.role), member, family });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { familyCode, name, password } = req.body;
    const family = await prisma.family.findUnique({ where: { inviteCode: familyCode } });
    if (!family) return res.status(400).json({ error: 'Family not found' });
    const member = await prisma.member.findFirst({
      where: { familyId: family.id, name },
      select: { ...MEMBER_SELECT, password: true }
    });
    if (!member) return res.status(400).json({ error: 'Member not found' });
    const ok = await bcrypt.compare(password, member.password);
    if (!ok) return res.status(400).json({ error: 'Wrong password' });
    const { password: _, ...memberData } = member;
    res.json({ token: makeToken(member.id, family.id, member.role), member: memberData, family });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Join an existing family
router.post('/join', async (req, res) => {
  try {
    const { inviteCode, name, emoji, color, password, role } = req.body;
    const family = await prisma.family.findUnique({ where: { inviteCode } });
    if (!family) return res.status(400).json({ error: 'Invalid invite code' });
    const hash = await bcrypt.hash(password, 10);
    const member = await prisma.member.create({
      data: {
        familyId: family.id, name, emoji: emoji || '🙂',
        color: color || '#F472B6', role: role || 'child', password: hash, stars: 0
      },
      select: MEMBER_SELECT
    });
    res.json({ token: makeToken(member.id, family.id, member.role), member, family });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Get current member info
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No token' });
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as any;
    const member = await prisma.member.findUnique({
      where: { id: payload.memberId },
      select: MEMBER_SELECT
    });
    const family = await prisma.family.findUnique({ where: { id: payload.familyId } });
    res.json({ member, family });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;