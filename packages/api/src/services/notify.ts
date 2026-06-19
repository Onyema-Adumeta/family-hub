import { prisma } from '../db';
import { sendPushToMember } from '../routes/notifications';

/**
 * Create an in-app notification row AND attempt a push (no-op if no token).
 * Push failures are swallowed so they can never break the triggering request.
 *
 * @param familyId  family the notification belongs to
 * @param memberId  recipient member id (must be the person who needs to KNOW,
 *                  i.e. not the actor who triggered the event)
 */
export async function notifyMember(
  familyId: string,
  memberId: string,
  title: string,
  body: string,
) {
  try {
    await prisma.notification.create({
      data: { familyId, memberId, title, body },
    });
  } catch (e) {
    console.error('notifyMember: failed to write notification row', e);
    return; // if the DB row failed, don't bother pushing
  }
  try {
    await sendPushToMember(memberId, title, body);
  } catch (e) {
    // Push is best-effort; never surface this to the caller
    console.error('notifyMember: push failed (non-fatal)', e);
  }
}

/** Notify every parent in a family (used for "needs approval" style events). */
export async function notifyParents(
  familyId: string,
  title: string,
  body: string,
  exceptMemberId?: string,
) {
  try {
    const parents = await prisma.member.findMany({
      where: { familyId, role: 'parent' },
      select: { id: true },
    });
    await Promise.all(
      parents
        .filter(p => p.id !== exceptMemberId)
        .map(p => notifyMember(familyId, p.id, title, body)),
    );
  } catch (e) {
    console.error('notifyParents: failed', e);
  }
}