// Family goals: one shared star target at a time, with a progress bar.
import { prisma } from '../db';
import { broadcast } from './websocket';

/** The family's active goal (not archived) with live progress, or null. */
export async function familyGoalProgress(familyId: string) {
  const goal = await prisma.familyGoal.findFirst({ where: { familyId, archivedAt: null }, orderBy: { createdAt: 'desc' } });
  if (!goal) return null;
  const until = goal.reachedAt ?? undefined;
  const [chores, quests] = await Promise.all([
    prisma.choreCompletion.aggregate({ where: { familyId, completedAt: { gte: goal.startsAt, ...(until ? { lte: until } : {}) } }, _sum: { stars: true } }),
    prisma.quest.aggregate({ where: { familyId, completedAt: { gte: goal.startsAt, ...(until ? { lte: until } : {}) } }, _sum: { stars: true } }),
  ]);
  const progress = (chores._sum.stars || 0) + (quests._sum.stars || 0);
  return {
    id: goal.id, title: goal.title, emoji: goal.emoji, reward: goal.reward, targetStars: goal.targetStars,
    startsAt: goal.startsAt, reachedAt: goal.reachedAt,
    progress: Math.min(progress, goal.targetStars), pct: Math.min(100, Math.round((progress / goal.targetStars) * 100)),
    remaining: Math.max(0, goal.targetStars - progress),
  };
}

/** Call after stars are earned: marks the goal reached (once) and tells everyone. */
export async function checkFamilyGoal(familyId: string) {
  const g = await familyGoalProgress(familyId);
  if (!g || g.reachedAt || g.remaining > 0) return null;
  const claimed = await prisma.familyGoal.updateMany({ where: { id: g.id, reachedAt: null }, data: { reachedAt: new Date() } });
  if (claimed.count !== 1) return null;
  const members = await prisma.member.findMany({ where: { familyId }, select: { id: true } });
  await prisma.notification.createMany({
    data: members.map(m => ({ familyId, memberId: m.id, title: `${g.emoji} Family goal reached!`, body: `You did it together: ${g.title}${g.reward ? ` — ${g.reward}` : ''}` })),
  });
  broadcast(familyId, { type: 'goal:reached', goal: g });
  return g;
}
