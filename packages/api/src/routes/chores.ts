import { Router } from 'express';
import { ChoreStatus, Prisma } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { broadcast } from '../services/websocket';
import { notifyMember } from '../services/notify';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { prisma } from '../db';
import { audit } from '../services/audit';
import { membersInFamily, requireParent } from '../lib/guards';
import { notifyParents } from '../services/notify';
import { checkFamilyGoal } from '../services/goals';
import { advanceRotation, nextTurn } from '../services/rotation';
import { Celebration, bumpStreak, checkAchievements, grantStars, levelsBefore, localDay, revokeStars } from '../services/gamification';

const router = Router();

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

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// Standard include used on every chore response
const choreInclude = {
  assignedTo:  { select: { id: true, name: true, emoji: true, color: true, avatarUrl: true } },
  completedBy: { select: { id: true, name: true, emoji: true, color: true } },
  assignees:   { select: { id: true, name: true, emoji: true, color: true, avatarUrl: true } },
};

const MAX_STARS = 1000;

// Normalize assignee input: accept assigneeIds[] (new) or fall back to assignedToId (legacy single)
function resolveAssigneeIds(body: any): string[] {
  if (Array.isArray(body.assigneeIds)) {
    return body.assigneeIds.filter((x: any) => typeof x === 'string' && x.length > 0);
  }
  if (body.assignedToId) return [body.assignedToId];
  return [];
}

function parseStars(value: any): number | null {
  const n = typeof value === 'number' ? value : parseInt(value, 10);
  if (!Number.isInteger(n) || n < 0 || n > MAX_STARS) return null;
  return n;
}

// Notify each newly-assigned member (except the person doing the assigning)
async function notifyAssigned(familyId: string, actorId: string | undefined, assigneeIds: string[], choreTitle: string) {
  const recipients = assigneeIds.filter(id => id !== actorId);
  await Promise.all(recipients.map(id =>
    notifyMember(familyId, id, 'New chore assigned', `You've been assigned "${choreTitle}"`),
  ));
}

// Who gets how many stars for completing a chore.
// Split among assignees; the completer gets the remainder so nothing is lost.
// No assignees -> full stars to whoever completed it.
function starShares(stars: number, assigneeIds: string[], completerId: string): Map<string, number> {
  const shares = new Map<string, number>();
  const add = (id: string, n: number) => { if (n > 0) shares.set(id, (shares.get(id) || 0) + n); };
  if (!assigneeIds.length) { add(completerId, stars); return shares; }
  const base = Math.floor(stars / assigneeIds.length);
  const remainder = stars - base * assigneeIds.length;
  for (const aid of assigneeIds) add(aid, base);
  add(completerId, remainder);
  return shares;
}

// GET /api/chores
router.get('/', async (req: AuthRequest, res) => {
  try {
    const chores = await prisma.chore.findMany({
      where: { familyId: req.familyId, archivedAt: null },
      include: choreInclude,
      orderBy: { createdAt: 'desc' },
    });
    res.json(chores);
  } catch {
    res.status(500).json({ error: 'Could not load chores' });
  }
});

// Reversible parent review: archive duplicates or restart pending routines.
router.get('/review', async (req: AuthRequest, res) => {
  if (!requireParent(req, res)) return;
  try { res.json(await prisma.chore.findMany({ where: { familyId: req.familyId }, include: choreInclude, orderBy: { createdAt: 'desc' } })); }
  catch { res.status(500).json({ error: 'Could not load review' }); }
});
router.post('/review', async (req: AuthRequest, res) => {
  if (!requireParent(req, res)) return;
  const { ids, action } = req.body || {};
  if (!Array.isArray(ids) || !ids.length || ids.length > 100 || ids.some((id: any) => typeof id !== 'string') || !['archive', 'restore', 'restart'].includes(action)) return res.status(400).json({ error: 'Choose tasks and an action' });
  try {
    const selected = await prisma.chore.findMany({ where: { id: { in: ids }, familyId: req.familyId } });
    if (selected.length !== new Set(ids).size) return res.status(400).json({ error: 'Some tasks are no longer available' });
    if (action !== 'restore' && selected.some(c => c.status === 'done')) return res.status(400).json({ error: 'Completed tasks are preserved; choose unfinished tasks' });
    if (action === 'restart' && selected.some(c => !['daily', 'weekly'].includes(c.frequency))) return res.status(400).json({ error: 'Restart is for daily or weekly routines only' });
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Vancouver', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const data = action === 'archive' ? { archivedAt: new Date() } : action === 'restore' ? { archivedAt: null } : { dueDate: new Date(today + 'T23:59:59.999Z'), archivedAt: null };
    const result = await prisma.chore.updateMany({ where: { id: { in: ids }, familyId: req.familyId, ...(action === 'restore' ? {} : { status: { not: 'done' } }) }, data });
    broadcast(req.familyId!, { type: 'chores:reviewed' }); res.json({ updated: result.count });
  } catch { res.status(500).json({ error: 'Could not update review' }); }
});

// POST /api/chores — parents create chores
router.post('/', async (req: AuthRequest, res) => {
  if (!requireParent(req, res)) return;
  try {
    const { title, emoji, frequency, stars, proofRequired, dueDate, rotate, priority, notes, recurring } = req.body || {};
    if (typeof title !== 'string' || !title.trim() || title.length > 200) return res.status(400).json({ error: 'title is required' });
    const starValue = stars === undefined || stars === null || stars === '' ? 5 : parseStars(stars);
    if (starValue === null) return res.status(400).json({ error: `Stars must be a whole number from 0 to ${MAX_STARS}` });
    const assigneeIds = resolveAssigneeIds(req.body);
    if (!(await membersInFamily(assigneeIds, req.familyId!))) return res.status(400).json({ error: 'Invalid assignee' });
    // "Take turns": the chosen people rotate, one at a time, starting with the first.
    if (rotate && assigneeIds.length < 2) return res.status(400).json({ error: 'Pick at least two people to take turns' });
    const rotationIds = rotate ? [...assigneeIds] : [];
    if (rotate) assigneeIds.splice(1);

    const chore = await prisma.chore.create({
      data: {
        familyId:      req.familyId!,
        title:         title.trim(),
        emoji:         emoji || '✅',
        frequency:     frequency || 'daily',
        stars:         starValue,
        proofRequired: !!proofRequired,
        // Mirror first assignee into assignedToId so legacy reads keep working
        assignedToId:  assigneeIds[0] || null,
        assignees:     assigneeIds.length ? { connect: assigneeIds.map(id => ({ id })) } : undefined,
        dueDate:       dueDate ? new Date(dueDate) : null,
        status:        ChoreStatus.pending,
        rotate:        !!rotate,
        priority:      priority ? String(priority).slice(0, 20) : 'normal',
        notes:         notes ? String(notes).slice(0, 1000) : null,
        recurring:     !!recurring,
        rotationIds,
        rotationIndex: 0,
      },
      include: choreInclude,
    });
    broadcast(req.familyId!, { type: 'chore:created', chore });
    await notifyAssigned(req.familyId!, req.memberId, assigneeIds, chore.title);
    await audit(req, 'chore.created', `created chore "${chore.title}" (${chore.stars}⭐)`, { type: 'chore', id: chore.id });
    res.json(chore);
  } catch (e) {
    console.error('POST /chores error:', e);
    res.status(400).json({ error: 'Could not create chore' });
  }
});

// Fields a child may send when updating a chore assigned to them.
const CHILD_FIELDS = new Set(['status', 'proofUrl', 'proofType']);

// PATCH /api/chores/:id
router.patch('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const isParent = req.role === 'parent';

    const existing = await prisma.chore.findFirst({
      where: { id, familyId: req.familyId },
      include: { assignees: { select: { id: true } } },
    });
    if (!existing) return res.status(404).json({ error: 'Chore not found' });

    const previousAssigneeIds = existing.assignees.map(a => a.id);

    if (!isParent) {
      // Kids can only work on chores that are theirs (or unassigned), and only
      // change status / attach proof. Everything else is a parent decision.
      const sentKeys = Object.keys(body).filter(k => body[k] !== undefined);
      if (sentKeys.some(k => !CHILD_FIELDS.has(k))) return res.status(403).json({ error: 'Only parents can edit chore details' });
      const mine = previousAssigneeIds.length === 0 || previousAssigneeIds.includes(req.memberId!) || existing.assignedToId === req.memberId;
      if (!mine) return res.status(403).json({ error: 'This chore is assigned to someone else' });
      if (existing.status === 'done' && body.status !== undefined && body.status !== 'done') {
        return res.status(403).json({ error: 'Ask a parent to undo a completed chore' });
      }
    }

    const { status, title, emoji, frequency, stars, proofRequired, proofUrl, proofType, dueDate, priority, notes, recurring } = body;
    const updateData: Prisma.ChoreUpdateInput = {};
    if (title !== undefined) {
      if (typeof title !== 'string' || !title.trim() || title.length > 200) return res.status(400).json({ error: 'Invalid title' });
      updateData.title = title.trim();
    }
    if (emoji         !== undefined) updateData.emoji         = emoji;
    if (frequency     !== undefined) updateData.frequency     = frequency;
    if (stars         !== undefined) {
      const s = parseStars(stars);
      if (s === null) return res.status(400).json({ error: `Stars must be a whole number from 0 to ${MAX_STARS}` });
      updateData.stars = s;
    }
    if (proofRequired !== undefined) updateData.proofRequired = !!proofRequired;
    if (proofUrl      !== undefined) updateData.proofUrl      = proofUrl;
    if (proofType     !== undefined) updateData.proofType     = proofType;
    if (dueDate       !== undefined) updateData.dueDate       = dueDate ? new Date(dueDate) : null;
    if (priority      !== undefined) updateData.priority      = String(priority).slice(0, 20);
    if (notes         !== undefined) updateData.notes         = notes ? String(notes).slice(0, 1000) : null;
    if (recurring     !== undefined) updateData.recurring     = !!recurring;

    // Assignee changes (parents only — enforced above): accept assigneeIds[] or legacy assignedToId
    let newAssigneeIds: string[] | undefined;
    if (body.assigneeIds !== undefined || body.assignedToId !== undefined) {
      newAssigneeIds = resolveAssigneeIds(body);
      if (!(await membersInFamily(newAssigneeIds, req.familyId!))) return res.status(400).json({ error: 'Invalid assignee' });
      updateData.assignees  = { set: newAssigneeIds.map(aid => ({ id: aid })) };
      updateData.assignedTo = newAssigneeIds[0] ? { connect: { id: newAssigneeIds[0] } } : { disconnect: true };
    }
    // Turning "take turns" on or off (parents only). The listed people rotate;
    // the first one is up now.
    if (body.rotate !== undefined) {
      if (body.rotate) {
        const ids = newAssigneeIds ?? (existing.rotate ? existing.rotationIds : previousAssigneeIds);
        if (ids.length < 2) return res.status(400).json({ error: 'Pick at least two people to take turns' });
        updateData.rotate = true;
        updateData.rotationIds = ids;
        updateData.rotationIndex = 0;
        newAssigneeIds = [ids[0]];
        updateData.assignees = { set: [{ id: ids[0] }] };
        updateData.assignedTo = { connect: { id: ids[0] } };
      } else {
        updateData.rotate = false;
        updateData.rotationIds = [];
        updateData.rotationIndex = 0;
      }
    }
    const effectiveAssigneeIds = newAssigneeIds ?? previousAssigneeIds;
    const addedAssigneeIds = newAssigneeIds ? newAssigneeIds.filter(aid => !previousAssigneeIds.includes(aid)) : [];

    if (status !== undefined && !['pending', 'in_progress', 'done'].includes(status)) {
      // "review" is only set by the photo-proof flow, never directly.
      return res.status(400).json({ error: 'Invalid status: ' + status });
    }

    // ── Photo proof: a kid's "done" on a proof-required chore waits for a parent ──
    if (status === 'done' && existing.status !== 'done' && !isParent && existing.proofRequired) {
      if (existing.status === 'review') return res.status(409).json({ error: 'Already waiting for a parent to check' });
      const hasProof = !!(proofUrl || existing.proofUrl || existing.photoUrl);
      if (!hasProof) return res.status(400).json({ error: 'Add a photo first — this chore needs proof' });
      const chore = await prisma.chore.update({
        where: { id },
        data: { ...updateData, status: 'review', submittedAt: new Date(), submittedById: req.memberId, reviewNote: null },
        include: choreInclude,
      });
      const kid = await prisma.member.findUnique({ where: { id: req.memberId }, select: { name: true } });
      await notifyParents(req.familyId!, 'Chore to check 📸', `${kid?.name} finished "${existing.title}" — tap to approve`, req.memberId);
      await audit(req, 'chore.submitted', `sent "${existing.title}" for a parent to check`, { type: 'chore', id });
      broadcast(req.familyId!, { type: 'chore:updated', chore });
      return res.json({ ...chore, awaitingApproval: true });
    }

    // ── Completing a chore ────────────────────────────────────────────────────
    if (status === 'done' && existing.status !== 'done') {
      const result = await completeChore(req, existing, req.memberId!, updateData, effectiveAssigneeIds);
      if (!result) return res.status(409).json({ error: 'This chore is already done' });
      if (addedAssigneeIds.length) await notifyAssigned(req.familyId!, req.memberId, addedAssigneeIds, existing.title);
      return res.json({ ...result.completedChore, celebrations: result.celebrations });
    }

    // ── Undoing a completion (parents only — enforced above) ─────────────────
    if (status !== undefined && status !== 'done' && existing.status === 'done') {
      const chore = await prisma.$transaction(async tx => {
        const reopened = await tx.chore.updateMany({
          where: { id, familyId: req.familyId, status: 'done' },
          data: { status: status as ChoreStatus, completedAt: null, completedById: null },
        });
        if (reopened.count !== 1) return null;
        if (existing.completedAt) {
          // Take back exactly the stars that this completion gave out.
          const rows = await tx.choreCompletion.findMany({ where: { choreId: id, completedAt: existing.completedAt } });
          for (const r of rows) await revokeStars(tx, r.memberId, r.stars);
          await tx.choreCompletion.deleteMany({ where: { choreId: id, completedAt: existing.completedAt } });
        }
        return tx.chore.update({ where: { id }, data: updateData, include: choreInclude });
      });
      if (!chore) return res.status(409).json({ error: 'This chore was already reopened' });
      await audit(req, 'chore.reopened', `undid completion of "${existing.title}" (stars taken back)`, { type: 'chore', id });
      broadcast(req.familyId!, { type: 'chore:updated', chore });
      return res.json(chore);
    }

    if (status !== undefined) {
      updateData.status = status as ChoreStatus;
      // Leaving review (kid withdraws it, or a parent resets it) clears the submission.
      if (existing.status === 'review') { updateData.submittedAt = null; updateData.submittedById = null; }
    }

    const chore = await prisma.chore.update({ where: { id }, data: updateData, include: choreInclude });
    broadcast(req.familyId!, { type: 'chore:updated', chore });
    if (isParent && (stars !== undefined && chore.stars !== existing.stars)) {
      await audit(req, 'chore.stars_changed', `changed "${chore.title}" from ${existing.stars}⭐ to ${chore.stars}⭐`, { type: 'chore', id });
    } else if (isParent) {
      await audit(req, 'chore.edited', `edited chore "${chore.title}"`, { type: 'chore', id });
    }
    if (addedAssigneeIds.length) await notifyAssigned(req.familyId!, req.memberId, addedAssigneeIds, chore.title);
    res.json(chore);
  } catch (e) {
    console.error('PATCH /chores error:', e);
    res.status(400).json({ error: 'Could not update chore' });
  }
});

type ChoreWithAssignees = Prisma.ChoreGetPayload<{ include: { assignees: { select: { id: true } } } }>;

/**
 * Marks a chore done and pays out stars exactly once (the ChoreCompletion
 * ledger), updates streaks, recycles daily chores, then checks for badges and
 * level-ups. `completerId` is who did the chore (the kid, even when a parent
 * approves their photo). Returns null if someone else completed it first.
 */
async function completeChore(
  req: AuthRequest,
  existing: ChoreWithAssignees,
  completerId: string,
  updateData: Prisma.ChoreUpdateInput,
  assigneeIds: string[],
): Promise<{ completedChore: any; newChore: any; celebrations: Celebration[] } | null> {
  const id = existing.id;
  const completedAt = new Date();
  const choreStars = (updateData.stars as number | undefined) ?? existing.stars;
  const shares = starShares(choreStars, assigneeIds, completerId);
  const wasLate = !!existing.dueDate && localDay() > existing.dueDate.toISOString().slice(0, 10);
  const earners = [...new Set([...shares.keys(), ...assigneeIds])];
  const stillHere = new Set((await prisma.member.findMany({ where: { familyId: req.familyId }, select: { id: true } })).map(m => m.id));
  const before = await levelsBefore(earners);

  const result = await prisma.$transaction(async tx => {
    // Atomic claim: only one request can move this chore to done.
    const claimed = await tx.chore.updateMany({
      where: { id, familyId: req.familyId, status: { not: 'done' } },
      data: { status: 'done', completedAt, completedById: completerId, submittedAt: null, submittedById: null },
    });
    if (claimed.count !== 1) return null;

    for (const [memberId, n] of shares) {
      await grantStars(tx, memberId, n);
      await tx.choreCompletion.create({
        data: { familyId: req.familyId!, choreId: id, choreTitle: existing.title, memberId, stars: n, completedAt },
      });
    }

    // Streaks: one per day, for everyone the chore belonged to (or the completer).
    for (const aid of assigneeIds.length ? assigneeIds : [completerId]) {
      if (wasLate) {
        await tx.member.update({ where: { id: aid }, data: { streakDays: 0, totalChoresDone: { increment: 1 } } });
        await tx.notification.create({
          data: { familyId: req.familyId!, memberId: aid, title: 'Chore overdue!', body: '"' + existing.title + '" was completed late - streak reset.' },
        });
      } else {
        await bumpStreak(tx, aid);
      }
    }

    const completedChore = await tx.chore.update({ where: { id }, data: updateData, include: choreInclude });

    // Daily chores: recycle into tomorrow's copy. The star history lives in
    // ChoreCompletion, so nothing is lost.
    let newChore = null;
    if (existing.frequency === 'daily') {
      await tx.chore.delete({ where: { id } });
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(23, 59, 59, 0);
      const next = nextAssignees(existing, assigneeIds, stillHere);
      newChore = await tx.chore.create({
        data: {
          familyId: existing.familyId, title: completedChore.title, emoji: completedChore.emoji,
          frequency: 'daily', stars: completedChore.stars, proofRequired: completedChore.proofRequired,
          priority: completedChore.priority, notes: completedChore.notes,
          ...rotationCarry(existing, stillHere),
          assignedToId: next[0] || null,
          assignees: next.length ? { connect: next.map(aid => ({ id: aid })) } : undefined,
          dueDate: tomorrow, status: 'pending',
        },
        include: choreInclude,
      });
    }
    return { completedChore, newChore };
  });
  if (!result) return null;

  const who = await prisma.member.findUnique({ where: { id: completerId }, select: { name: true } });
  await audit(
    req,
    'chore.completed',
    completerId === req.memberId ? `completed "${existing.title}" (${choreStars}⭐)` : `approved ${who?.name}'s "${existing.title}" (${choreStars}⭐)`,
    { type: 'chore', id },
  );
  broadcast(req.familyId!, { type: 'chore:updated', chore: result.completedChore });
  if (result.newChore) {
    broadcast(req.familyId!, { type: 'chore:deleted', id });
    broadcast(req.familyId!, { type: 'chore:created', chore: result.newChore });
  }
  const celebrations = await checkAchievements(earners, before);
  await checkFamilyGoal(req.familyId!);
  if (celebrations.length) broadcast(req.familyId!, { type: 'celebration', celebrations });
  return { ...result, celebrations };
}

// Fair rotation for daily chores: tomorrow's copy goes to the next person.
function nextAssignees(existing: ChoreWithAssignees, current: string[], stillHere: Set<string>) {
  const turn = nextTurn(existing, stillHere);
  return turn ? [turn.assigneeId] : current;
}
function rotationCarry(existing: ChoreWithAssignees, stillHere: Set<string>) {
  const turn = nextTurn(existing, stillHere);
  return existing.rotate && turn
    ? { rotate: true, rotationIds: turn.rotationIds, rotationIndex: turn.rotationIndex }
    : { rotate: existing.rotate, rotationIds: existing.rotationIds, rotationIndex: existing.rotationIndex };
}

// POST /api/chores/:id/rotate — parent skips to the next person's turn
router.post('/:id/rotate', async (req: AuthRequest, res) => {
  if (!requireParent(req, res)) return;
  try {
    const c = await prisma.chore.findFirst({ where: { id: req.params.id, familyId: req.familyId } });
    if (!c) return res.status(404).json({ error: 'Chore not found' });
    if (!c.rotate) return res.status(400).json({ error: 'This chore does not take turns' });
    await advanceRotation(c.id);
    const chore = await prisma.chore.findUnique({ where: { id: c.id }, include: choreInclude });
    broadcast(req.familyId!, { type: 'chore:updated', chore });
    res.json(chore);
  } catch { res.status(500).json({ error: 'Could not move to the next turn' }); }
});

// GET /api/chores/awaiting-approval — photo-proof chores waiting for a parent
router.get('/awaiting-approval', async (req: AuthRequest, res) => {
  if (!requireParent(req, res)) return;
  try {
    const chores = await prisma.chore.findMany({
      where: { familyId: req.familyId, status: 'review', archivedAt: null },
      include: choreInclude,
      orderBy: { submittedAt: 'asc' },
    });
    const kids = await prisma.member.findMany({ where: { id: { in: chores.map(c => c.submittedById!).filter(Boolean) } }, select: { id: true, name: true, emoji: true, color: true } });
    res.json(chores.map(c => ({ ...c, submittedBy: kids.find(k => k.id === c.submittedById) || null })));
  } catch { res.status(500).json({ error: 'Could not load chores to check' }); }
});

// POST /api/chores/:id/approve — parent approves a photo; stars land
router.post('/:id/approve', async (req: AuthRequest, res) => {
  if (!requireParent(req, res)) return;
  try {
    const existing = await prisma.chore.findFirst({ where: { id: req.params.id, familyId: req.familyId }, include: { assignees: { select: { id: true } } } });
    if (!existing) return res.status(404).json({ error: 'Chore not found' });
    if (existing.status !== 'review' || !existing.submittedById) return res.status(409).json({ error: 'This chore is not waiting for approval' });
    const result = await completeChore(req, existing, existing.submittedById, {}, existing.assignees.map(a => a.id));
    if (!result) return res.status(409).json({ error: 'This chore is already done' });
    await notifyMember(req.familyId!, existing.submittedById, 'Approved! ⭐', `"${existing.title}" was approved — ${existing.stars} stars for you`);
    res.json({ ...result.completedChore, celebrations: result.celebrations });
  } catch (e) { console.error('approve error', e); res.status(500).json({ error: 'Could not approve' }); }
});

// POST /api/chores/:id/reject — parent sends it back with a short note
router.post('/:id/reject', async (req: AuthRequest, res) => {
  if (!requireParent(req, res)) return;
  try {
    const note = typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 300) : '';
    const existing = await prisma.chore.findFirst({ where: { id: req.params.id, familyId: req.familyId } });
    if (!existing) return res.status(404).json({ error: 'Chore not found' });
    if (existing.status !== 'review') return res.status(409).json({ error: 'This chore is not waiting for approval' });
    const kidId = existing.submittedById;
    const chore = await prisma.chore.update({
      where: { id: existing.id },
      data: { status: 'pending', submittedAt: null, submittedById: null, reviewNote: note || null, photoUrl: null, proofUrl: null },
      include: choreInclude,
    });
    if (kidId) await notifyMember(req.familyId!, kidId, 'Not quite yet', `"${existing.title}" needs another go${note ? `: ${note}` : ''}`);
    await audit(req, 'chore.sent_back', `sent "${existing.title}" back${note ? `: ${note}` : ''}`, { type: 'chore', id: existing.id });
    broadcast(req.familyId!, { type: 'chore:updated', chore });
    res.json(chore);
  } catch { res.status(500).json({ error: 'Could not send back' }); }
});

// PATCH /api/chores/:id/photo
router.patch('/:id/photo', async (req: AuthRequest, res, next) => {
  // Check access before accepting an upload.
  const chore = await prisma.chore.findFirst({ where: { id: req.params.id, familyId: req.familyId }, include: { assignees: { select: { id: true } } } });
  if (!chore) return res.status(404).json({ error: 'Chore not found' });
  if (req.role !== 'parent') {
    const ids = chore.assignees.map(a => a.id);
    if (ids.length && !ids.includes(req.memberId!) && chore.assignedToId !== req.memberId) return res.status(403).json({ error: 'This chore is assigned to someone else' });
  }
  next();
}, upload.single('photo'), async (req: AuthRequest, res) => {
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
  } catch (e) {
    console.error('PATCH /chores/:id/photo error:', e);
    res.status(500).json({ error: 'Could not save photo' });
  }
});

// DELETE /api/chores/:id — parents only
router.delete('/:id', async (req: AuthRequest, res) => {
  if (!requireParent(req, res)) return;
  try {
    const victim = await prisma.chore.findFirst({ where: { id: req.params.id, familyId: req.familyId }, select: { title: true } });
    const result = await prisma.chore.deleteMany({ where: { id: req.params.id, familyId: req.familyId } });
    if (!result.count) return res.status(404).json({ error: 'Chore not found' });
    await audit(req, 'chore.deleted', `deleted chore "${victim?.title}"`, { type: 'chore', id: req.params.id });
    broadcast(req.familyId!, { type: 'chore:deleted', id: req.params.id });
    res.json({ ok: true });
  } catch {
    res.status(400).json({ error: 'Could not delete chore' });
  }
});

// POST /api/chores/reset-daily (manual trigger, parents only)
router.post('/reset-daily', async (req: AuthRequest, res) => {
  if (!requireParent(req, res)) return;
  try {
    await prisma.chore.updateMany({
      where: { familyId: req.familyId, frequency: 'daily' },
      data:  { status: ChoreStatus.pending, completedAt: null, completedById: null, proofUrl: null },
    });
    res.json({ ok: true });
  } catch {
    res.status(400).json({ error: 'Could not reset chores' });
  }
});

export default router;
