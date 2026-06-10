"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const zod_1 = require("zod");
const router = (0, express_1.Router)();
const db_1 = require("../db");
// ── Rate limiters ─────────────────────────────────────────────────────────────
const authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: 'Too many attempts, please try again in 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
});
const registerLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: { error: 'Too many accounts created, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});
// ── Zod schemas ───────────────────────────────────────────────────────────────
const RegisterSchema = zod_1.z.object({
    familyName: zod_1.z.string().min(1).max(50).trim(),
    name: zod_1.z.string().min(1).max(50).trim(),
    emoji: zod_1.z.string().max(10).optional(),
    color: zod_1.z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    email: zod_1.z.string().email().optional().or(zod_1.z.literal('')),
});
const LoginSchema = zod_1.z.object({
    familyCode: zod_1.z.string().min(1).max(20).trim().toUpperCase(),
    name: zod_1.z.string().min(1).max(50).trim(),
});
const JoinSchema = zod_1.z.object({
    inviteCode: zod_1.z.string().min(1).max(20).trim().toUpperCase(),
    name: zod_1.z.string().min(1).max(50).trim(),
    emoji: zod_1.z.string().max(10).optional(),
    color: zod_1.z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    role: zod_1.z.enum(['parent', 'child']).optional(),
});
// ── Helpers ───────────────────────────────────────────────────────────────────
function makeInviteCode() {
    return 'FAM-' + Math.random().toString(36).substring(2, 6).toUpperCase();
}
function makeToken(memberId, familyId, role) {
    return jsonwebtoken_1.default.sign({ memberId, familyId, role }, process.env.JWT_SECRET, { expiresIn: '30d' });
}
const MEMBER_SELECT = {
    id: true, name: true, emoji: true, color: true,
    role: true, stars: true, avatarUrl: true, email: true, createdAt: true,
};
// ── Register ──────────────────────────────────────────────────────────────────
router.post('/register', registerLimiter, async (req, res) => {
    try {
        const parsed = RegisterSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: parsed.error.errors[0].message });
        }
        const { familyName, name, emoji, color, email } = parsed.data;
        const family = await db_1.prisma.family.create({
            data: {
                name: familyName,
                inviteCode: makeInviteCode(),
                members: {
                    create: {
                        name, emoji: emoji || '👨', color: color || '#6366F1',
                        role: 'parent', password: '', email: email || null, stars: 0,
                    },
                },
            },
            include: { members: { select: MEMBER_SELECT } },
        });
        const member = family.members[0];
        res.json({ token: makeToken(member.id, family.id, member.role), member, family });
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
// ── Login ─────────────────────────────────────────────────────────────────────
router.post('/login', authLimiter, async (req, res) => {
    try {
        const parsed = LoginSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: parsed.error.errors[0].message });
        }
        const { familyCode, name } = parsed.data;
        const family = await db_1.prisma.family.findUnique({ where: { inviteCode: familyCode } });
        if (!family)
            return res.status(400).json({ error: 'Family not found — check your family code' });
        const member = await db_1.prisma.member.findFirst({
            where: { familyId: family.id, name: { equals: name, mode: 'insensitive' } },
            select: MEMBER_SELECT,
        });
        if (!member)
            return res.status(400).json({ error: 'Name not found in this family' });
        res.json({ token: makeToken(member.id, family.id, member.role), member, family });
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
// ── Join ──────────────────────────────────────────────────────────────────────
router.post('/join', authLimiter, async (req, res) => {
    try {
        const parsed = JoinSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: parsed.error.errors[0].message });
        }
        const { inviteCode, name, emoji, color, role } = parsed.data;
        const family = await db_1.prisma.family.findUnique({ where: { inviteCode } });
        if (!family)
            return res.status(400).json({ error: 'Invalid invite code' });
        const existing = await db_1.prisma.member.findFirst({
            where: { familyId: family.id, name: { equals: name, mode: 'insensitive' } },
        });
        if (existing)
            return res.status(400).json({ error: 'That name is already taken in this family' });
        const member = await db_1.prisma.member.create({
            data: {
                familyId: family.id, name, emoji: emoji || '🙂',
                color: color || '#F472B6', role: role || 'child', password: '', stars: 0,
            },
            select: MEMBER_SELECT,
        });
        res.json({ token: makeToken(member.id, family.id, member.role), member, family });
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
// ── Me ────────────────────────────────────────────────────────────────────────
router.get('/me', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token)
            return res.status(401).json({ error: 'No token' });
        const payload = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        const member = await db_1.prisma.member.findUnique({
            where: { id: payload.memberId },
            select: MEMBER_SELECT,
        });
        const family = await db_1.prisma.family.findUnique({ where: { id: payload.familyId } });
        res.json({ member, family });
    }
    catch {
        res.status(401).json({ error: 'Invalid token' });
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map