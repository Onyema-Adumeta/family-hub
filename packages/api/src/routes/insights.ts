// Weekly Wins (a celebration of the week) and the morning briefing.
// Template-based: no AI involved, nothing leaves the server.
import { Router } from 'express';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../db';
import { levelFor } from '../services/gamification';
import { addDays, dayName, localHour, mondayOf, startOfDay, ymd } from '../services/familyTime';
import { familyGoalProgress } from '../services/goals';
import { computeFairness, recommendations } from '../services/advisor';
import { requireParent } from '../lib/guards';

const router = Router();
const memberSelect = { id: true, name: true, emoji: true, color: true, role: true, stars: true, lifetimeStars: true, streakDays: true, birthday: true } as const;

// ── Weekly Wins ───────────────────────────────────────────────────────────────
// GET /api/insights/wins?week=YYYY-MM-DD  (any day in the week; default: this week)
router.get('/wins', async (req: AuthRequest, res) => {
  try {
    const requested = typeof req.query.week === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.week) ? req.query.week : ymd();
    const weekStart = mondayOf(requested);
    const from = startOfDay(weekStart);
    const to = startOfDay(addDays(weekStart, 7));
    const prevFrom = startOfDay(addDays(weekStart, -7));
    const familyId = req.familyId!;

    const [members, completions, prevCompletions, quests, achievements, redemptions] = await Promise.all([
      prisma.member.findMany({ where: { familyId }, select: memberSelect, orderBy: { createdAt: 'asc' } }),
      prisma.choreCompletion.findMany({ where: { familyId, completedAt: { gte: from, lt: to } } }),
      prisma.choreCompletion.findMany({ where: { familyId, completedAt: { gte: prevFrom, lt: from } } }),
      prisma.quest.findMany({ where: { familyId, completedAt: { gte: from, lt: to } }, select: { id: true, title: true, memberId: true, stars: true } }),
      prisma.achievement.findMany({ where: { familyId, createdAt: { gte: from, lt: to } }, orderBy: { createdAt: 'asc' } }),
      prisma.redemption.findMany({ where: { familyId, approved: true, createdAt: { gte: from, lt: to } }, include: { reward: { select: { name: true, emoji: true } } } }),
    ]);

    // Distinct chores per member (shared chores count once per person).
    const per = members.map(m => {
      const mine = completions.filter(c => c.memberId === m.id);
      const prev = prevCompletions.filter(c => c.memberId === m.id);
      const lvl = levelFor(m.lifetimeStars);
      return {
        id: m.id, name: m.name, emoji: m.emoji, color: m.color, role: m.role,
        stars: mine.reduce((s, c) => s + c.stars, 0) + quests.filter(q => q.memberId === m.id).reduce((s, q) => s + q.stars, 0),
        chores: new Set(mine.map(c => c.choreId + c.completedAt.toISOString())).size,
        prevStars: prev.reduce((s, c) => s + c.stars, 0),
        streakDays: m.streakDays || 0,
        level: lvl.level, levelTitle: lvl.title,
        quests: quests.filter(q => q.memberId === m.id).length,
        achievements: achievements.filter(a => a.memberId === m.id).map(a => a.label),
      };
    });

    const familyStars = per.reduce((s, m) => s + m.stars, 0);
    const prevFamilyStars = prevCompletions.reduce((s, c) => s + c.stars, 0);
    const familyChores = new Set(completions.map(c => c.choreId + c.completedAt.toISOString())).size;
    const changePct = prevFamilyStars > 0 ? Math.round(((familyStars - prevFamilyStars) / prevFamilyStars) * 100) : null;

    const top = (key: (m: typeof per[number]) => number, min = 1) => {
      const best = [...per].sort((a, b) => key(b) - key(a))[0];
      return best && key(best) >= min ? best : null;
    };
    const awards: { title: string; icon: string; memberId: string; name: string; detail: string }[] = [];
    const star = top(m => m.stars);
    if (star) awards.push({ title: 'Star of the week', icon: '🌟', memberId: star.id, name: star.name, detail: `${star.stars} stars earned` });
    const streak = top(m => m.streakDays, 2);
    if (streak) awards.push({ title: 'Streak keeper', icon: '🔥', memberId: streak.id, name: streak.name, detail: `${streak.streakDays}-day streak` });
    const improved = top(m => m.stars - m.prevStars, 5);
    if (improved && improved.id !== star?.id) awards.push({ title: 'Most improved', icon: '📈', memberId: improved.id, name: improved.name, detail: `+${improved.stars - improved.prevStars} stars on last week` });
    const questStar = top(m => m.quests);
    if (questStar) awards.push({ title: 'Quest master', icon: '⚔️', memberId: questStar.id, name: questStar.name, detail: `${questStar.quests} quest${questStar.quests > 1 ? 's' : ''} completed` });
    const collector = top(m => m.achievements.length);
    if (collector) awards.push({ title: 'Badge collector', icon: '🏅', memberId: collector.id, name: collector.name, detail: collector.achievements.join(', ') });

    const highlights: string[] = [];
    if (familyStars > 0) highlights.push(`Together you earned ${familyStars} stars${changePct !== null ? ` — ${changePct >= 0 ? 'up' : 'down'} ${Math.abs(changePct)}% on last week` : ''}.`);
    if (familyChores > 0) highlights.push(`${familyChores} chore${familyChores > 1 ? 's' : ''} done as a family.`);
    for (const a of achievements.filter(x => x.kind === 'level')) {
      highlights.push(`${members.find(m => m.id === a.memberId)?.name} reached ${a.label}!`);
    }
    for (const r of redemptions) highlights.push(`${members.find(m => m.id === r.memberId)?.name} cashed in ${r.reward.emoji} ${r.reward.name}.`);
    if (!highlights.length) highlights.push('A fresh week — every chore from here counts!');

    res.json({
      weekStart, weekEnd: addDays(weekStart, 6), isCurrentWeek: weekStart === mondayOf(ymd()),
      family: { stars: familyStars, chores: familyChores, prevStars: prevFamilyStars, changePct },
      members: per, awards, highlights,
    });
  } catch (e) { console.error('wins error', e); res.status(500).json({ error: 'Could not build Weekly Wins' }); }
});

// ── Fairness meter ───────────────────────────────────────────────────────────
// GET /api/insights/fairness?days=14 — how evenly the kids share the work
router.get('/fairness', async (req: AuthRequest, res) => {
  const days = Math.min(Math.max(parseInt(String(req.query.days || '14'), 10) || 14, 1), 90);
  try { res.json(await computeFairness(req.familyId!, days)); }
  catch (e) { console.error('fairness error', e); res.status(500).json({ error: 'Could not work out fairness' }); }
});

// ── Recommendations ──────────────────────────────────────────────────────────
// GET /api/insights/recommendations — the next few things a parent could do
router.get('/recommendations', async (req: AuthRequest, res) => {
  if (!requireParent(req, res)) return;
  try { res.json(await recommendations(req.familyId!)); }
  catch (e) { console.error('recommendations error', e); res.status(500).json({ error: 'Could not build recommendations' }); }
});

// ── Morning briefing ──────────────────────────────────────────────────────────
// GET /api/insights/briefing — what today looks like, for the whole family.
router.get('/briefing', async (req: AuthRequest, res) => {
  try {
    res.json(await buildBriefing(req.familyId!, req.memberId!, req.role === 'parent'));
  } catch (e) { console.error('briefing error', e); res.status(500).json({ error: 'Could not build the briefing' }); }
});

export default router;

export async function buildBriefing(familyId: string, memberId: string, isParent: boolean) {
    const today = ymd();
    const dayStart = startOfDay(today);
    const dayEnd = startOfDay(addDays(today, 1));
    const [members, chores, events, meals, waiting, goal] = await Promise.all([
      prisma.member.findMany({ where: { familyId }, select: memberSelect, orderBy: { createdAt: 'asc' } }),
      prisma.chore.findMany({
        where: { familyId, archivedAt: null, status: { in: ['pending', 'in_progress', 'review'] }, OR: [{ frequency: 'daily' }, { dueDate: { lt: dayEnd } }] },
        include: { assignees: { select: { id: true } } },
      }),
      prisma.event.findMany({ where: { familyId, date: { gte: dayStart, lt: dayEnd } }, orderBy: { time: 'asc' }, select: { id: true, title: true, emoji: true, time: true, assignedToId: true } }),
      prisma.meal.findMany({ where: { familyId, week: mondayOf(today), day: dayName(today) }, select: { name: true, emoji: true, slot: true } }),
      isParent ? prisma.chore.count({ where: { familyId, status: 'review' } }) : Promise.resolve(0),
      familyGoalProgress(familyId),
    ]);
    const pendingRewards = isParent ? await prisma.redemption.count({ where: { familyId, approved: false, status: 'pending' } }) : 0;

    const birthdays = members.filter(m => m.birthday && m.birthday.toISOString().slice(5, 10) === today.slice(5));
    const people = members.map(m => {
      const mine = chores.filter(c => c.assignees.some(a => a.id === m.id) || c.assignedToId === m.id);
      const overdue = mine.filter(c => c.dueDate && c.dueDate < dayStart).length;
      const lvl = levelFor(m.lifetimeStars);
      return {
        id: m.id, name: m.name, emoji: m.emoji, color: m.color, role: m.role,
        stars: m.stars, streakDays: m.streakDays || 0, level: lvl.level, levelTitle: lvl.title, nextLevelAt: lvl.nextAt, lifetimeStars: m.lifetimeStars,
        choresToday: mine.filter(c => c.status !== 'review').map(c => ({ id: c.id, title: c.title, emoji: c.emoji, stars: c.stars, overdue: !!(c.dueDate && c.dueDate < dayStart) })),
        waitingForParent: mine.filter(c => c.status === 'review').length,
        overdue,
      };
    });
    const dinner = meals.find(m => m.slot === 'dinner') || null;

    const h = localHour();
    const greeting = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    const me = people.find(p => p.id === memberId);
    const bits: string[] = [];
    if (me) bits.push(me.choresToday.length ? `${me.choresToday.length} chore${me.choresToday.length > 1 ? 's' : ''} for you today` : 'no chores for you today');
    if (events.length) bits.push(`${events.length} thing${events.length > 1 ? 's' : ''} on the calendar${events[0].time ? ` (first at ${events[0].time})` : ''}`);
    if (dinner) bits.push(`${dinner.emoji} ${dinner.name} for dinner`);
    if (waiting) bits.push(`${waiting} chore photo${waiting > 1 ? 's' : ''} to check`);
    if (pendingRewards) bits.push(`${pendingRewards} reward request${pendingRewards > 1 ? 's' : ''} waiting`);
    let summary = `${greeting}${me ? `, ${me.name}` : ''}! ${bits.length ? bits.join(', ') : 'Nothing scheduled — enjoy the day'}.`;
    if (birthdays.length) summary += ` 🎂 Happy birthday ${birthdays.map(b => b.name).join(' and ')}!`;
    if (me && me.streakDays >= 2 && me.choresToday.length) summary += ` Keep your ${me.streakDays}-day streak going 🔥`;

    return { date: today, dayName: dayName(today), greeting, summary, people, events, dinner, meals, waitingForApproval: waiting, pendingRewards, birthdays: birthdays.map(b => b.name), goal };
}

