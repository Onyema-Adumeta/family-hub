import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../db';

// Fields that are safe to show to anyone in the same family.
// Never include password, pushToken, email or location here.
export const PUBLIC_MEMBER_SELECT = {
  id: true,
  familyId: true,
  name: true,
  emoji: true,
  color: true,
  avatarUrl: true,
  role: true,
  stars: true,
  streakDays: true,
  streakUpdatedAt: true,
  totalChoresDone: true,
  badges: true,
  birthday: true,
  rewardGoalId: true,
  canOpenPersonalOS: true,
  canOpenPremed: true,
  createdAt: true,
} as const;

// The signed-in member's own record may also show their own email.
export const SELF_MEMBER_SELECT = { ...PUBLIC_MEMBER_SELECT, email: true } as const;

// Family fields safe to send to the client. Google tokens and Stripe ids stay on the server.
export const PUBLIC_FAMILY_SELECT = {
  id: true,
  name: true,
  inviteCode: true,
  plan: true,
  createdAt: true,
} as const;

/** Returns true if the caller is a parent; otherwise sends 403 and returns false. */
export function requireParent(req: AuthRequest, res: Response): boolean {
  if (req.role === 'parent') return true;
  res.status(403).json({ error: 'Parents only' });
  return false;
}

/** True when every id is a distinct member of the given family. Empty list is valid. */
export async function membersInFamily(ids: unknown, familyId: string): Promise<boolean> {
  if (!Array.isArray(ids)) return false;
  if (ids.length === 0) return true;
  if (ids.some(id => typeof id !== 'string' || !id)) return false;
  const unique = new Set(ids as string[]);
  if (unique.size !== ids.length) return false;
  const count = await prisma.member.count({ where: { id: { in: [...unique] }, familyId } });
  return count === unique.size;
}

/** True when a single member id belongs to the family. */
export async function memberInFamily(id: unknown, familyId: string): Promise<boolean> {
  if (typeof id !== 'string' || !id) return false;
  return (await prisma.member.count({ where: { id, familyId } })) === 1;
}

/** Copy only the listed keys from body (skips undefined). Stops mass-assignment of familyId etc. */
export function pick<T extends string>(body: any, keys: readonly T[]): Partial<Record<T, any>> {
  const out: Partial<Record<T, any>> = {};
  if (!body || typeof body !== 'object') return out;
  for (const k of keys) if (body[k] !== undefined) out[k] = body[k];
  return out;
}
