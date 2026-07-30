import { Router } from 'express';
import { AuthRequest } from '../middleware/auth';
import { broadcast } from '../services/websocket';
import { prisma } from '../db';

const router = Router();

// Shared include shape so every route returns trips in a consistent, full shape
const tripInclude = {
  createdBy: { select: { id: true, name: true, emoji: true, color: true } },
  packingItems: {
    include: { member: { select: { id: true, name: true, emoji: true, color: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
  itineraryDays: {
    orderBy: { date: 'asc' as const },
    include: {
      activities: {
        orderBy: { createdAt: 'asc' as const },
        include: { assignees: { select: { id: true, name: true, emoji: true, color: true } } },
      },
    },
  },
};

// ── Trips ────────────────────────────────────────────────────────────────

router.get('/', async (req: AuthRequest, res) => {
  try {
    const trips = await prisma.trip.findMany({
      where: { familyId: req.familyId! },
      orderBy: { startDate: 'asc' },
      include: tripInclude,
    });
    res.json(trips);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:tripId', async (req: AuthRequest, res) => {
  try {
    const trip = await prisma.trip.findFirst({
      where: { id: req.params.tripId, familyId: req.familyId! },
      include: tripInclude,
    });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    res.json(trip);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', async (req: AuthRequest, res) => {
  const { title, destination, startDate, endDate, notes } = req.body;
  if (!title || !startDate || !endDate) {
    return res.status(400).json({ error: 'title, startDate, and endDate are required' });
  }
  try {
    const trip = await prisma.trip.create({
      data: {
        familyId: req.familyId!,
        title,
        destination: destination || null,
        // Anchor date-only values to local noon before this hits the DB on the
        // frontend side — same UTC-shift issue fixed on the meals page. Backend
        // just stores whatever ISO string it receives.
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        notes: notes || null,
        createdById: req.memberId!,
      },
      include: tripInclude,
    });

    await prisma.notification.create({
      data: {
        familyId: req.familyId!,
        title: `New trip: ${trip.title}`,
        body: `${trip.createdBy.name} planned a trip${destination ? ` to ${destination}` : ''}. Start packing!`,
      },
    });

    broadcast(req.familyId!, { type: 'trip:created', trip });
    res.json(trip);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/:tripId', async (req: AuthRequest, res) => {
  const { title, destination, startDate, endDate, notes } = req.body;
  try {
    const existing = await prisma.trip.findFirst({ where: { id: req.params.tripId, familyId: req.familyId! } });
    if (!existing) return res.status(404).json({ error: 'Trip not found' });

    const trip = await prisma.trip.update({
      where: { id: req.params.tripId },
      data: {
        ...(title !== undefined && { title }),
        ...(destination !== undefined && { destination }),
        ...(startDate !== undefined && { startDate: new Date(startDate) }),
        ...(endDate !== undefined && { endDate: new Date(endDate) }),
        ...(notes !== undefined && { notes }),
      },
      include: tripInclude,
    });

    broadcast(req.familyId!, { type: 'trip:updated', trip });
    res.json(trip);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:tripId', async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.trip.findFirst({ where: { id: req.params.tripId, familyId: req.familyId! } });
    if (!existing) return res.status(404).json({ error: 'Trip not found' });

    // onDelete: Cascade on PackingItem, ItineraryDay, and ItineraryActivity
    // handles cleanup automatically - no manual deleteMany calls needed.
    await prisma.trip.delete({ where: { id: req.params.tripId } });

    broadcast(req.familyId!, { type: 'trip:deleted', tripId: req.params.tripId });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Packing items (per-member lists within a trip) ─────────────────────────

router.post('/:tripId/packing', async (req: AuthRequest, res) => {
  const { name, quantity, category, memberId } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const trip = await prisma.trip.findFirst({ where: { id: req.params.tripId, familyId: req.familyId! } });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    // Defaults to the requesting member's own list if memberId isn't specified,
    // but allows adding to someone else's list (e.g. a parent packing for a
    // young child).
    const item = await prisma.packingItem.create({
      data: {
        tripId: req.params.tripId,
        memberId: memberId || req.memberId!,
        name,
        quantity: quantity ?? 1,
        category: category || null,
      },
      include: { member: { select: { id: true, name: true, emoji: true, color: true } } },
    });

    broadcast(req.familyId!, { type: 'trip:packing_added', tripId: req.params.tripId, item });
    res.json(item);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/packing/:itemId', async (req: AuthRequest, res) => {
  const { name, quantity, category, packed } = req.body;
  try {
    const existing = await prisma.packingItem.findFirst({
      where: { id: req.params.itemId, trip: { familyId: req.familyId! } },
    });
    if (!existing) return res.status(404).json({ error: 'Packing item not found' });

    const item = await prisma.packingItem.update({
      where: { id: req.params.itemId },
      data: {
        ...(name !== undefined && { name }),
        ...(quantity !== undefined && { quantity }),
        ...(category !== undefined && { category }),
        ...(packed !== undefined && { packed }),
      },
      include: { member: { select: { id: true, name: true, emoji: true, color: true } } },
    });

    broadcast(req.familyId!, { type: 'trip:packing_updated', tripId: existing.tripId, item });
    res.json(item);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/packing/:itemId', async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.packingItem.findFirst({
      where: { id: req.params.itemId, trip: { familyId: req.familyId! } },
    });
    if (!existing) return res.status(404).json({ error: 'Packing item not found' });

    await prisma.packingItem.delete({ where: { id: req.params.itemId } });

    broadcast(req.familyId!, { type: 'trip:packing_deleted', tripId: existing.tripId, itemId: req.params.itemId });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Itinerary days ───────────────────────────────────────────────────────

router.post('/:tripId/days', async (req: AuthRequest, res) => {
  const { date, title, notes } = req.body;
  if (!date) return res.status(400).json({ error: 'date is required' });
  try {
    const trip = await prisma.trip.findFirst({ where: { id: req.params.tripId, familyId: req.familyId! } });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    const day = await prisma.itineraryDay.create({
      data: {
        tripId: req.params.tripId,
        date: new Date(date),
        title: title || null,
        notes: notes || null,
      },
      include: {
        activities: { include: { assignees: { select: { id: true, name: true, emoji: true, color: true } } } },
      },
    });

    broadcast(req.familyId!, { type: 'trip:day_added', tripId: req.params.tripId, day });
    res.json(day);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/days/:dayId', async (req: AuthRequest, res) => {
  const { date, title, notes } = req.body;
  try {
    const existing = await prisma.itineraryDay.findFirst({
      where: { id: req.params.dayId, trip: { familyId: req.familyId! } },
    });
    if (!existing) return res.status(404).json({ error: 'Itinerary day not found' });

    const day = await prisma.itineraryDay.update({
      where: { id: req.params.dayId },
      data: {
        ...(date !== undefined && { date: new Date(date) }),
        ...(title !== undefined && { title }),
        ...(notes !== undefined && { notes }),
      },
      include: {
        activities: { include: { assignees: { select: { id: true, name: true, emoji: true, color: true } } } },
      },
    });

    broadcast(req.familyId!, { type: 'trip:day_updated', tripId: existing.tripId, day });
    res.json(day);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/days/:dayId', async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.itineraryDay.findFirst({
      where: { id: req.params.dayId, trip: { familyId: req.familyId! } },
    });
    if (!existing) return res.status(404).json({ error: 'Itinerary day not found' });

    // onDelete: Cascade on ItineraryActivity handles cleanup of that day's activities.
    await prisma.itineraryDay.delete({ where: { id: req.params.dayId } });

    broadcast(req.familyId!, { type: 'trip:day_deleted', tripId: existing.tripId, dayId: req.params.dayId });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Itinerary activities ────────────────────────────────────────────────

router.post('/days/:dayId/activities', async (req: AuthRequest, res) => {
  const { title, time, location, notes, assigneeIds } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  try {
    const day = await prisma.itineraryDay.findFirst({
      where: { id: req.params.dayId, trip: { familyId: req.familyId! } },
    });
    if (!day) return res.status(404).json({ error: 'Itinerary day not found' });

    const activity = await prisma.itineraryActivity.create({
      data: {
        dayId: req.params.dayId,
        title,
        time: time || null,
        location: location || null,
        notes: notes || null,
        assignees: Array.isArray(assigneeIds) && assigneeIds.length
          ? { connect: assigneeIds.map((id: string) => ({ id })) }
          : undefined,
      },
      include: { assignees: { select: { id: true, name: true, emoji: true, color: true } } },
    });

    if (activity.assignees.length) {
      await prisma.notification.create({
        data: {
          familyId: req.familyId!,
          title: `New itinerary activity: ${activity.title}`,
          body: `You've been assigned to "${activity.title}"${time ? ` at ${time}` : ''}.`,
        },
      });
    }

    broadcast(req.familyId!, { type: 'trip:activity_added', dayId: req.params.dayId, activity });
    res.json(activity);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/activities/:activityId', async (req: AuthRequest, res) => {
  const { title, time, location, notes, assigneeIds } = req.body;
  try {
    const existing = await prisma.itineraryActivity.findFirst({
      where: { id: req.params.activityId, day: { trip: { familyId: req.familyId! } } },
    });
    if (!existing) return res.status(404).json({ error: 'Activity not found' });

    const activity = await prisma.itineraryActivity.update({
      where: { id: req.params.activityId },
      data: {
        ...(title !== undefined && { title }),
        ...(time !== undefined && { time }),
        ...(location !== undefined && { location }),
        ...(notes !== undefined && { notes }),
        // 'set' replaces the full assignee list wholesale - simplest correct
        // behavior for an editable multi-select in the UI.
        ...(Array.isArray(assigneeIds) && {
          assignees: { set: assigneeIds.map((id: string) => ({ id })) },
        }),
      },
      include: { assignees: { select: { id: true, name: true, emoji: true, color: true } } },
    });

    broadcast(req.familyId!, { type: 'trip:activity_updated', dayId: existing.dayId, activity });
    res.json(activity);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/activities/:activityId', async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.itineraryActivity.findFirst({
      where: { id: req.params.activityId, day: { trip: { familyId: req.familyId! } } },
    });
    if (!existing) return res.status(404).json({ error: 'Activity not found' });

    await prisma.itineraryActivity.delete({ where: { id: req.params.activityId } });

    broadcast(req.familyId!, { type: 'trip:activity_deleted', dayId: existing.dayId, activityId: req.params.activityId });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;