"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPushToMember = sendPushToMember;
const express_1 = require("express");
const router = (0, express_1.Router)();
const db_1 = require("../db");
// ─── Read notifications ───────────────────────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const notifications = await db_1.prisma.notification.findMany({
            where: {
                familyId: req.familyId,
                OR: [{ memberId: req.memberId }, { memberId: null }],
            },
            orderBy: { createdAt: 'desc' },
            take: 30,
        });
        res.json(notifications);
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});
router.patch('/:id/read', async (req, res) => {
    try {
        await db_1.prisma.notification.update({
            where: { id: req.params.id },
            data: { read: true },
        });
        res.json({ ok: true });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to mark read' });
    }
});
router.patch('/read-all', async (req, res) => {
    try {
        await db_1.prisma.notification.updateMany({
            where: { familyId: req.familyId, memberId: req.memberId },
            data: { read: true },
        });
        res.json({ ok: true });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to mark all read' });
    }
});
// ─── Push token registration ──────────────────────────────────────────────────
// POST /api/notifications/register-push
// Called from the web/mobile app after the user grants notification permission.
// Stores the Expo push token on the member row so cron jobs can reach them.
router.post('/register-push', async (req, res) => {
    const { token } = req.body;
    if (!token)
        return res.status(400).json({ error: 'token is required' });
    try {
        await db_1.prisma.member.update({
            where: { id: req.memberId },
            data: { pushToken: token },
        });
        res.json({ ok: true });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to save push token' });
    }
});
// DELETE /api/notifications/register-push  — unsubscribe (e.g. on sign-out)
router.delete('/register-push', async (req, res) => {
    try {
        await db_1.prisma.member.update({
            where: { id: req.memberId },
            data: { pushToken: null },
        });
        res.json({ ok: true });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to remove push token' });
    }
});
// ─── Send a push notification ─────────────────────────────────────────────────
// Shared helper — used by the route below AND importable by cron jobs / other routes
async function sendPushToMember(memberId, title, body) {
    const member = await db_1.prisma.member.findUnique({ where: { id: memberId } });
    if (!member?.pushToken)
        return { sent: false, reason: 'no token' };
    const payload = {
        to: member.pushToken,
        title,
        body,
        sound: 'default',
        data: { memberId },
    };
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify(payload),
    });
    const result = await response.json();
    const status = result?.data?.status;
    // Expo returns 'DeviceNotRegistered' when the token is stale — clean it up
    if (status === 'error' && result?.data?.message === 'DeviceNotRegistered') {
        await db_1.prisma.member.update({ where: { id: memberId }, data: { pushToken: null } });
        return { sent: false, reason: 'DeviceNotRegistered — token cleared' };
    }
    return { sent: status === 'ok', status };
}
// POST /api/notifications/send
// Body: { memberId, title, body }
// Also saves a DB notification record so it shows up in the bell/list.
router.post('/send', async (req, res) => {
    const { memberId, title, body } = req.body;
    if (!memberId || !title || !body) {
        return res.status(400).json({ error: 'memberId, title, and body are required' });
    }
    try {
        // Save to DB so it shows in the notification list regardless of push delivery
        await db_1.prisma.notification.create({
            data: {
                familyId: req.familyId,
                memberId,
                title,
                body,
                read: false,
            },
        });
        const pushResult = await sendPushToMember(memberId, title, body);
        res.json({ ok: true, push: pushResult });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to send notification' });
    }
});
// POST /api/notifications/broadcast
// Sends to every member in the family who has a push token
router.post('/broadcast', async (req, res) => {
    const { title, body } = req.body;
    if (!title || !body)
        return res.status(400).json({ error: 'title and body are required' });
    try {
        const members = await db_1.prisma.member.findMany({
            where: { familyId: req.familyId },
        });
        // Save one DB notification per member
        await db_1.prisma.notification.createMany({
            data: members.map(m => ({
                familyId: req.familyId,
                memberId: m.id,
                title,
                body,
                read: false,
            })),
        });
        // Fire push notifications concurrently
        const results = await Promise.allSettled(members.filter(m => m.pushToken).map(m => sendPushToMember(m.id, title, body)));
        res.json({ ok: true, sent: results.filter(r => r.status === 'fulfilled').length });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to broadcast notification' });
    }
});
exports.default = router;
//# sourceMappingURL=notifications.js.map