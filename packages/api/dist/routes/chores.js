"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const websocket_1 = require("../services/websocket");
const multer_1 = __importDefault(require("multer"));
const cloudinary_1 = require("cloudinary");
const multer_storage_cloudinary_1 = require("multer-storage-cloudinary");
const router = (0, express_1.Router)();
const db_1 = require("../db");
cloudinary_1.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});
const storage = new multer_storage_cloudinary_1.CloudinaryStorage({
    cloudinary: cloudinary_1.v2,
    params: {
        folder: 'family-hub/chores',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'heic'],
    },
});
const upload = (0, multer_1.default)({ storage });
// GET /api/chores
router.get('/', async (req, res) => {
    try {
        const chores = await db_1.prisma.chore.findMany({
            where: { familyId: req.familyId },
            include: {
                assignedTo: { select: { id: true, name: true, emoji: true, color: true, avatarUrl: true } },
                completedBy: { select: { id: true, name: true, emoji: true, color: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json(chores);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// POST /api/chores
router.post('/', async (req, res) => {
    try {
        const { title, emoji, frequency, stars, proofRequired, assignedToId, dueDate } = req.body;
        const chore = await db_1.prisma.chore.create({
            data: {
                familyId: req.familyId,
                title,
                emoji: emoji || '?',
                frequency: frequency || 'daily',
                stars: stars ? parseInt(stars) : 5,
                proofRequired: proofRequired ?? false,
                assignedToId: assignedToId || null,
                dueDate: dueDate ? new Date(dueDate) : null,
                status: client_1.ChoreStatus.pending,
            },
            include: {
                assignedTo: { select: { id: true, name: true, emoji: true, color: true, avatarUrl: true } },
                completedBy: { select: { id: true, name: true, emoji: true, color: true } },
            },
        });
        (0, websocket_1.broadcast)(req.familyId, { type: 'chore:created', chore });
        res.json(chore);
    }
    catch (e) {
        console.error('POST /chores error:', e);
        res.status(400).json({ error: e.message });
    }
});
// PATCH /api/chores/:id
router.patch('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, assignedToId, title, emoji, frequency, stars, proofRequired, proofUrl, proofType, dueDate, } = req.body;
        const existing = await db_1.prisma.chore.findUnique({ where: { id } });
        if (!existing)
            return res.status(404).json({ error: 'Chore not found' });
        const updateData = {};
        if (title !== undefined)
            updateData.title = title;
        if (emoji !== undefined)
            updateData.emoji = emoji;
        if (frequency !== undefined)
            updateData.frequency = frequency;
        if (stars !== undefined)
            updateData.stars = parseInt(stars);
        if (proofRequired !== undefined)
            updateData.proofRequired = proofRequired;
        if (proofUrl !== undefined)
            updateData.proofUrl = proofUrl;
        if (proofType !== undefined)
            updateData.proofType = proofType;
        if (dueDate !== undefined)
            updateData.dueDate = dueDate ? new Date(dueDate) : null;
        if (assignedToId !== undefined)
            updateData.assignedToId = assignedToId || null;
        if (status !== undefined) {
            const validStatuses = ['pending', 'in_progress', 'done'];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({ error: 'Invalid status: ' + status });
            }
            updateData.status = status;
            if (status === 'done' && existing.status !== 'done') {
                updateData.completedAt = new Date();
                updateData.completedById = req.memberId;
                // Award stars to whoever completed it
                await db_1.prisma.member.update({
                    where: { id: req.memberId },
                    data: { stars: { increment: existing.stars } },
                });
                // Streak logic
                if (existing.dueDate && new Date() > existing.dueDate && existing.assignedToId) {
                    await db_1.prisma.member.update({
                        where: { id: existing.assignedToId },
                        data: { streakDays: 0 },
                    });
                    await db_1.prisma.notification.create({
                        data: {
                            familyId: req.familyId,
                            memberId: existing.assignedToId,
                            title: 'Chore overdue!',
                            body: '"' + existing.title + '" was completed late - streak reset.',
                        },
                    });
                }
                else if (existing.assignedToId) {
                    await db_1.prisma.member.update({
                        where: { id: existing.assignedToId },
                        data: {
                            streakDays: { increment: 1 },
                            streakUpdatedAt: new Date(),
                            totalChoresDone: { increment: 1 },
                        },
                    });
                }
                // For daily chores: save details, delete this record, create tomorrow's copy
                if (existing.frequency === 'daily') {
                    // First finish saving the completed state so the UI sees it briefly
                    const completedChore = await db_1.prisma.chore.update({
                        where: { id },
                        data: updateData,
                        include: {
                            assignedTo: { select: { id: true, name: true, emoji: true, color: true, avatarUrl: true } },
                            completedBy: { select: { id: true, name: true, emoji: true, color: true } },
                        },
                    });
                    (0, websocket_1.broadcast)(req.familyId, { type: 'chore:updated', chore: completedChore });
                    // Delete the completed chore
                    await db_1.prisma.chore.delete({ where: { id } });
                    (0, websocket_1.broadcast)(req.familyId, { type: 'chore:deleted', id });
                    // Create fresh copy due tomorrow
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    tomorrow.setHours(23, 59, 59, 0);
                    const newChore = await db_1.prisma.chore.create({
                        data: {
                            familyId: existing.familyId,
                            title: existing.title,
                            emoji: existing.emoji,
                            frequency: 'daily',
                            stars: existing.stars,
                            proofRequired: existing.proofRequired,
                            assignedToId: existing.assignedToId,
                            dueDate: tomorrow,
                            status: 'pending',
                        },
                        include: {
                            assignedTo: { select: { id: true, name: true, emoji: true, color: true, avatarUrl: true } },
                            completedBy: { select: { id: true, name: true, emoji: true, color: true } },
                        },
                    });
                    (0, websocket_1.broadcast)(req.familyId, { type: 'chore:created', chore: newChore });
                    // Return the completed chore so the UI can show the done state momentarily
                    return res.json(completedChore);
                }
            }
            else if (status === 'pending') {
                updateData.completedAt = null;
                updateData.completedById = null;
            }
        }
        const chore = await db_1.prisma.chore.update({
            where: { id },
            data: updateData,
            include: {
                assignedTo: { select: { id: true, name: true, emoji: true, color: true, avatarUrl: true } },
                completedBy: { select: { id: true, name: true, emoji: true, color: true } },
            },
        });
        (0, websocket_1.broadcast)(req.familyId, { type: 'chore:updated', chore });
        res.json(chore);
    }
    catch (e) {
        console.error('PATCH /chores error:', e);
        res.status(400).json({ error: e.message });
    }
});
// PATCH /api/chores/:id/photo
router.patch('/:id/photo', upload.single('photo'), async (req, res) => {
    try {
        if (!req.file)
            return res.status(400).json({ error: 'No file uploaded' });
        const photoUrl = req.file.path;
        const chore = await db_1.prisma.chore.update({
            where: { id: req.params.id },
            data: { photoUrl, photoedAt: new Date() },
            include: {
                assignedTo: { select: { id: true, name: true, emoji: true, color: true, avatarUrl: true } },
                completedBy: { select: { id: true, name: true, emoji: true, color: true } },
            },
        });
        (0, websocket_1.broadcast)(req.familyId, { type: 'chore:updated', chore });
        res.json(chore);
    }
    catch (e) {
        console.error('PATCH /chores/:id/photo error:', e);
        res.status(500).json({ error: e.message });
    }
});
// DELETE /api/chores/:id
router.delete('/:id', async (req, res) => {
    try {
        await db_1.prisma.chore.delete({ where: { id: req.params.id } });
        (0, websocket_1.broadcast)(req.familyId, { type: 'chore:deleted', id: req.params.id });
        res.json({ ok: true });
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
// POST /api/chores/reset-daily (manual trigger, kept for admin use)
router.post('/reset-daily', async (req, res) => {
    try {
        await db_1.prisma.chore.updateMany({
            where: { familyId: req.familyId, frequency: 'daily' },
            data: { status: client_1.ChoreStatus.pending, completedAt: null, completedById: null, proofUrl: null },
        });
        res.json({ ok: true });
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=chores.js.map