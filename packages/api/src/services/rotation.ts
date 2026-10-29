// Fair rotation: a chore takes turns between members in a fixed order.
import { prisma } from '../db';

type Rotating = { rotate: boolean; rotationIds: string[]; rotationIndex: number };

/** Whose turn comes after the current one (skipping anyone no longer in the family). */
export function nextTurn(c: Rotating, stillHere: Set<string>) {
  const ids = c.rotationIds.filter(id => stillHere.has(id));
  if (!c.rotate || ids.length === 0) return null;
  const currentId = c.rotationIds[c.rotationIndex % c.rotationIds.length];
  const pos = Math.max(ids.indexOf(currentId), 0);
  const nextIndex = (pos + 1) % ids.length;
  return { rotationIds: ids, rotationIndex: nextIndex, assigneeId: ids[nextIndex] };
}

/** Moves a rotating chore to the next person's turn. Returns the new assignee id. */
export async function advanceRotation(choreId: string) {
  const chore = await prisma.chore.findUnique({ where: { id: choreId } });
  if (!chore || !chore.rotate) return null;
  const members = await prisma.member.findMany({ where: { familyId: chore.familyId }, select: { id: true } });
  const turn = nextTurn(chore, new Set(members.map(m => m.id)));
  if (!turn) return null;
  await prisma.chore.update({
    where: { id: chore.id },
    data: {
      rotationIds: turn.rotationIds, rotationIndex: turn.rotationIndex,
      assignedToId: turn.assigneeId, assignees: { set: [{ id: turn.assigneeId }] },
    },
  });
  return turn.assigneeId;
}

/** Weekly reset for rotating chores that were done: next person's turn, back to pending. */
export async function rotateFinishedWeeklyChores() {
  const done = await prisma.chore.findMany({ where: { rotate: true, frequency: 'weekly', status: 'done', archivedAt: null }, select: { id: true } });
  for (const c of done) await advanceRotation(c.id);
  return done.length;
}
