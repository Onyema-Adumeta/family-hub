import { prisma } from '../db';
import { AuthRequest } from '../middleware/auth';

/**
 * Records an entry in the family activity log. Best-effort: a logging failure
 * never breaks the action itself. Keep `summary` human-readable and never put
 * passwords, tokens or private message text in it.
 */
export async function audit(
  req: AuthRequest,
  action: string,
  summary: string,
  target?: { type: string; id?: string | null },
) {
  try {
    if (!req.familyId) return;
    const actor = req.memberId
      ? await prisma.member.findUnique({ where: { id: req.memberId }, select: { name: true } })
      : null;
    await prisma.auditLog.create({
      data: {
        familyId: req.familyId,
        actorId: req.memberId || null,
        actorName: actor?.name || 'Someone',
        action,
        targetType: target?.type || null,
        targetId: target?.id || null,
        summary: summary.slice(0, 300),
      },
    });
  } catch (e) {
    console.error('audit log write failed', e);
  }
}
