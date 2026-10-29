// Stars, levels, badges and streaks — the "come back tomorrow" loop.
import { Prisma } from '@prisma/client';
import { prisma } from '../db';

type Tx = Prisma.TransactionClient;

// Levels are based on lifetime stars, so spending stars on rewards never
// drops a child's level. Keep in sync with packages/web/src/lib/levels.ts.
export const LEVELS = [
  { level: 1, title: 'Rookie', min: 0 },
  { level: 2, title: 'Helper', min: 50 },
  { level: 3, title: 'Champion', min: 150 },
  { level: 4, title: 'Hero', min: 300 },
  { level: 5, title: 'Legend', min: 500 },
  { level: 6, title: 'Superstar', min: 1000 },
  { level: 7, title: 'Mythic', min: 2000 },
];
export function levelFor(lifetimeStars: number) {
  let current = LEVELS[0];
  for (const l of LEVELS) if (lifetimeStars >= l.min) current = l;
  const next = LEVELS.find(l => l.level === current.level + 1) || null;
  return { ...current, nextAt: next?.min ?? null };
}

export const BADGES: Record<string, { label: string; icon: string; test: (m: BadgeInput) => boolean }> = {
  first_chore: { label: 'First chore done', icon: '🌟', test: m => m.totalChoresDone >= 1 },
  chores_10:   { label: '10 chores done',  icon: '🧹', test: m => m.totalChoresDone >= 10 },
  chores_50:   { label: '50 chores done',  icon: '🏆', test: m => m.totalChoresDone >= 50 },
  chores_100:  { label: '100 chores done', icon: '👑', test: m => m.totalChoresDone >= 100 },
  streak_3:    { label: '3-day streak',    icon: '🔥', test: m => m.streakDays >= 3 },
  streak_7:    { label: '7-day streak',    icon: '🔥', test: m => m.streakDays >= 7 },
  streak_30:   { label: '30-day streak',   icon: '💎', test: m => m.streakDays >= 30 },
  star_50:     { label: '50 stars earned', icon: '⭐', test: m => m.lifetimeStars >= 50 },
  star_100:    { label: '100 stars earned', icon: '🌠', test: m => m.lifetimeStars >= 100 },
  star_500:    { label: '500 stars earned', icon: '🌌', test: m => m.lifetimeStars >= 500 },
  star_1000:   { label: '1,000 stars earned', icon: '🚀', test: m => m.lifetimeStars >= 1000 },
};
type BadgeInput = { totalChoresDone: number; streakDays: number; lifetimeStars: number };

export type Celebration = {
  memberId: string;
  name: string;
  badges: { code: string; label: string; icon: string }[];
  levelUp: { level: number; title: string } | null;
};

/** Gives stars that count toward levels. Use for every way of earning stars. */
export async function grantStars(tx: Tx, memberId: string, n: number) {
  if (n <= 0) return;
  await tx.member.update({ where: { id: memberId }, data: { stars: { increment: n }, lifetimeStars: { increment: n } } });
}
/** Takes back earned stars (a parent undoing a completion). */
export async function revokeStars(tx: Tx, memberId: string, n: number) {
  if (n <= 0) return;
  await tx.member.update({ where: { id: memberId }, data: { stars: { decrement: n }, lifetimeStars: { decrement: n } } });
}

/** Today's date in the family's time zone, as YYYY-MM-DD. */
export function localDay(d = new Date(), tz = 'America/Vancouver') {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/**
 * Streaks count DAYS, not chores: the first completion of a day extends the
 * streak by one; more completions that day don't add more (Muse D11).
 */
export async function bumpStreak(tx: Tx, memberId: string) {
  const m = await tx.member.findUnique({ where: { id: memberId }, select: { streakDays: true, streakUpdatedAt: true } });
  if (!m) return;
  const today = localDay();
  const last = m.streakUpdatedAt ? localDay(m.streakUpdatedAt) : null;
  if (last === today) {
    await tx.member.update({ where: { id: memberId }, data: { totalChoresDone: { increment: 1 } } });
    return;
  }
  const yesterday = localDay(new Date(Date.now() - 24 * 3600 * 1000));
  const streakDays = last === yesterday ? (m.streakDays || 0) + 1 : 1;
  await tx.member.update({ where: { id: memberId }, data: { streakDays, streakUpdatedAt: new Date(), totalChoresDone: { increment: 1 } } });
}

/** Snapshot of levels before an award, to detect level-ups afterwards. */
export async function levelsBefore(memberIds: string[]) {
  const rows = await prisma.member.findMany({ where: { id: { in: memberIds } }, select: { id: true, lifetimeStars: true } });
  return new Map(rows.map(r => [r.id, levelFor(r.lifetimeStars).level]));
}

/**
 * After stars/streaks change: award any newly earned badges and level-ups,
 * record them, notify the member, and return what to celebrate on screen.
 */
export async function checkAchievements(memberIds: string[], before: Map<string, number>): Promise<Celebration[]> {
  const out: Celebration[] = [];
  for (const id of [...new Set(memberIds)]) {
    const m = await prisma.member.findUnique({
      where: { id },
      select: { id: true, familyId: true, name: true, badges: true, totalChoresDone: true, streakDays: true, lifetimeStars: true },
    });
    if (!m) continue;
    const have = new Set(m.badges || []);
    const newBadges = Object.entries(BADGES)
      .filter(([code, b]) => !have.has(code) && b.test({ totalChoresDone: m.totalChoresDone, streakDays: m.streakDays || 0, lifetimeStars: m.lifetimeStars }))
      .map(([code, b]) => ({ code, label: b.label, icon: b.icon }));
    const lvl = levelFor(m.lifetimeStars);
    const levelUp = lvl.level > (before.get(id) ?? lvl.level) ? { level: lvl.level, title: lvl.title } : null;
    if (!newBadges.length && !levelUp) continue;

    if (newBadges.length) {
      await prisma.member.update({ where: { id }, data: { badges: [...have, ...newBadges.map(b => b.code)] } });
    }
    const records = [
      ...newBadges.map(b => ({ familyId: m.familyId, memberId: id, kind: 'badge', code: b.code, label: `${b.icon} ${b.label}` })),
      ...(levelUp ? [{ familyId: m.familyId, memberId: id, kind: 'level', code: String(levelUp.level), label: `Level ${levelUp.level}: ${levelUp.title}` }] : []),
    ];
    await prisma.achievement.createMany({ data: records, skipDuplicates: true });
    for (const r of records) {
      await prisma.notification.create({ data: { familyId: m.familyId, memberId: id, title: r.kind === 'level' ? '🎉 Level up!' : '🏅 New badge!', body: r.label } });
    }
    out.push({ memberId: id, name: m.name, badges: newBadges, levelUp });
  }
  return out;
}
