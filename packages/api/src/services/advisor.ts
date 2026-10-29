// Fairness meter and "what to do next" recommendations for parents.
// Plain rules on the family's own data — no AI, nothing leaves the server.
import { prisma } from '../db';
import { addDays, mondayOf, startOfDay, ymd, DAY_NAMES } from './familyTime';
import { familyGoalProgress } from './goals';

/** How evenly chore work is spread between the kids over the last `days` days. */
export async function computeFairness(familyId: string, days = 14) {
  const since = startOfDay(addDays(ymd(), -days));
  const kids = await prisma.member.findMany({ where: { familyId, role: 'child' }, select: { id: true, name: true, emoji: true, color: true }, orderBy: { createdAt: 'asc' } });
  if (kids.length < 2) return { applicable: false as const, days, kids: [] as any[], score: 100, status: 'balanced' as const, heaviest: null, suggestions: [] as any[] };

  const [done, open] = await Promise.all([
    prisma.choreCompletion.findMany({ where: { familyId, completedAt: { gte: since }, memberId: { in: kids.map(k => k.id) } } }),
    prisma.chore.findMany({ where: { familyId, archivedAt: null, status: { not: 'done' } }, include: { assignees: { select: { id: true } } } }),
  ]);
  const rows = kids.map(k => {
    const mine = done.filter(c => c.memberId === k.id);
    const openMine = open.filter(c => c.assignees.some(a => a.id === k.id) || c.assignedToId === k.id);
    const earned = mine.reduce((s, c) => s + c.stars, 0);
    const openLoad = openMine.reduce((s, c) => s + Math.round(c.stars / Math.max(c.assignees.length, 1)), 0);
    return { ...k, earned, choresDone: new Set(mine.map(c => c.choreId + c.completedAt.toISOString())).size, openLoad, openChores: openMine.length, work: earned + openLoad };
  });
  const total = rows.reduce((s, r) => s + r.work, 0);
  const withShare = rows.map(r => ({ ...r, sharePct: total ? Math.round((r.work / total) * 100) : Math.round(100 / rows.length) }));
  const spread = Math.max(...withShare.map(r => r.sharePct)) - Math.min(...withShare.map(r => r.sharePct));
  const score = Math.max(0, 100 - spread);
  const status = spread <= 20 ? 'balanced' : spread <= 40 ? 'uneven' : 'unfair';
  const heaviest = [...withShare].sort((a, b) => b.work - a.work)[0];

  // Chores only the busiest kid does, that could take turns instead.
  const suggestions = status === 'balanced' ? [] : open
    .filter(c => !c.rotate && c.assignees.length === 1 && c.assignees[0].id === heaviest.id)
    .slice(0, 3)
    .map(c => ({ choreId: c.id, title: c.title, emoji: c.emoji }));

  return { applicable: true as const, days, kids: withShare, score, status, heaviest: { id: heaviest.id, name: heaviest.name }, suggestions };
}

export type Recommendation = { kind: string; priority: number; icon: string; title: string; detail: string; link?: string; choreId?: string; memberId?: string };

/** The few most useful things a parent could do next. */
export async function recommendations(familyId: string): Promise<Recommendation[]> {
  const today = ymd();
  const dayStart = startOfDay(today);
  const recs: Recommendation[] = [];

  const [kids, openChores, waiting, pendingRewards, weekMeals, recent, goal, fairness] = await Promise.all([
    prisma.member.findMany({ where: { familyId, role: 'child' }, select: { id: true, name: true, stars: true, streakDays: true, streakUpdatedAt: true, rewardGoalId: true } }),
    prisma.chore.findMany({ where: { familyId, archivedAt: null, status: { in: ['pending', 'in_progress'] } }, include: { assignees: { select: { id: true, name: true } } } }),
    prisma.chore.count({ where: { familyId, status: 'review' } }),
    prisma.redemption.count({ where: { familyId, approved: false, status: 'pending' } }),
    prisma.meal.findMany({ where: { familyId, week: { in: [mondayOf(today), mondayOf(addDays(today, 3))] } }, select: { week: true, day: true, slot: true } }),
    prisma.choreCompletion.findMany({ where: { familyId, completedAt: { gte: startOfDay(addDays(today, -7)) } }, select: { memberId: true, completedAt: true, stars: true } }),
    familyGoalProgress(familyId),
    computeFairness(familyId),
  ]);

  if (waiting) recs.push({ kind: 'approvals', priority: 100, icon: '📸', title: `Check ${waiting} chore photo${waiting > 1 ? 's' : ''}`, detail: 'Kids are waiting for your OK before their stars land.', link: '/#approvals' });
  if (pendingRewards) recs.push({ kind: 'rewards', priority: 95, icon: '🎁', title: `Answer ${pendingRewards} reward request${pendingRewards > 1 ? 's' : ''}`, detail: 'Their stars are on hold until you approve or decline.', link: '/rewards' });

  // Chores that keep slipping: overdue by 3+ days.
  const avgStars = openChores.length ? openChores.reduce((s, c) => s + c.stars, 0) / openChores.length : 0;
  for (const c of openChores.filter(c => c.dueDate && c.dueDate < startOfDay(addDays(today, -2))).slice(0, 2)) {
    const days = Math.round((dayStart.getTime() - c.dueDate!.getTime()) / 86400000);
    const lowValue = c.stars < avgStars;
    recs.push({
      kind: 'slipping', priority: 80, icon: '⏰', choreId: c.id, link: '/chores',
      title: lowValue ? `Raise the stars on "${c.title}"` : (c.assignees.length < 2 ? `Split "${c.title}" between two kids` : `Talk about "${c.title}"`),
      detail: `It's ${days} days overdue${lowValue ? ` and worth fewer stars (${c.stars}) than most chores` : ''}.`,
    });
  }

  if (fairness.applicable && fairness.status !== 'balanced' && fairness.heaviest) {
    const s = fairness.suggestions[0];
    recs.push({
      kind: 'fairness', priority: 75, icon: '⚖️', memberId: fairness.heaviest.id, choreId: s?.choreId, link: '/chores',
      title: s ? `Make "${s.title}" take turns` : `Share more chores with others`,
      detail: `${fairness.heaviest.name} is doing ${fairness.kids.find((k: any) => k.id === fairness.heaviest!.id)?.sharePct}% of the kids' chore work right now.`,
    });
  }

  // Streaks at risk: a 3+ day streak with nothing done yet today.
  for (const k of kids) {
    const doneToday = k.streakUpdatedAt && ymd(k.streakUpdatedAt) === today;
    const hasChores = openChores.some(c => c.assignees.some(a => a.id === k.id));
    if ((k.streakDays || 0) >= 3 && !doneToday && hasChores) {
      recs.push({ kind: 'streak', priority: 70, icon: '🔥', memberId: k.id, title: `Cheer on ${k.name}`, detail: `A ${k.streakDays}-day streak ends tonight unless one chore gets done today.` });
    }
  }

  // Close to a reward they're saving for.
  const goalIds = kids.map(k => k.rewardGoalId).filter(Boolean) as string[];
  if (goalIds.length) {
    const rewards = await prisma.reward.findMany({ where: { id: { in: goalIds }, familyId }, select: { id: true, name: true, cost: true } });
    for (const k of kids) {
      const r = rewards.find(x => x.id === k.rewardGoalId);
      if (r && k.stars < r.cost && k.stars >= r.cost * 0.75) {
        recs.push({ kind: 'reward_close', priority: 60, icon: '🎯', memberId: k.id, title: `${k.name} is ${r.cost - k.stars} stars from "${r.name}"`, detail: 'A good moment to offer an extra chore.' });
      }
    }
  }

  // Quiet week for someone.
  for (const k of kids) {
    const hasChores = openChores.some(c => c.assignees.some(a => a.id === k.id));
    if (hasChores && !recent.some(c => c.memberId === k.id)) {
      recs.push({ kind: 'quiet', priority: 55, icon: '💬', memberId: k.id, title: `Check in with ${k.name}`, detail: 'No chores done in the last 7 days. Maybe fewer, smaller chores would help.' });
    }
  }

  // Meals for the next three days.
  const next3 = [0, 1, 2].map(i => addDays(today, i));
  const planned = next3.filter(d => {
    const [y, m, dd] = d.split('-').map(Number);
    const name = DAY_NAMES[new Date(Date.UTC(y, m - 1, dd)).getUTCDay()];
    return weekMeals.some(meal => meal.week === mondayOf(d) && meal.day === name && meal.slot === 'dinner');
  }).length;
  if (planned < 3) recs.push({ kind: 'meals', priority: 40, icon: '🍽️', title: `Plan ${3 - planned} dinner${3 - planned > 1 ? 's' : ''} for the next 3 days`, detail: 'The grocery list can be built from the plan.', link: '/meals' });

  // Family goal momentum.
  if (!goal) {
    recs.push({ kind: 'goal', priority: 30, icon: '🎯', title: 'Set a family goal', detail: 'A shared target (like a movie night) gets everyone pulling together.', link: '/' });
  } else if (!goal.reachedAt && goal.pct < 100) {
    const last3 = recent.filter(c => c.completedAt >= startOfDay(addDays(today, -3))).length;
    if (!last3) recs.push({ kind: 'goal_stalled', priority: 50, icon: '🎯', title: `"${goal.title}" has stalled`, detail: `${goal.remaining} stars to go and nothing earned in 3 days.`, link: '/' });
  }

  return recs.sort((a, b) => b.priority - a.priority).slice(0, 5);
}
