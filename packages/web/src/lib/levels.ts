// Levels come from lifetime stars, so spending stars never drops a level.
// Keep in sync with packages/api/src/services/gamification.ts.
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
  const next = LEVELS.find(l => l.level === current.level + 1);
  const span = next ? next.min - current.min : 1;
  const pct = next ? Math.min(100, Math.round(((lifetimeStars - current.min) / span) * 100)) : 100;
  return { ...current, next: next?.min ?? null, pct };
}

export const BADGE_META: Record<string, { icon: string; label: string; color: string }> = {
  first_chore: { icon: '🌟', label: 'First chore', color: '#FBBF24' },
  chores_10:   { icon: '🧹', label: '10 chores', color: '#34D399' },
  chores_50:   { icon: '🏆', label: '50 chores', color: '#F59E0B' },
  chores_100:  { icon: '👑', label: '100 chores', color: '#A78BFA' },
  streak_3:    { icon: '🔥', label: '3-day streak', color: '#FB923C' },
  streak_7:    { icon: '🔥', label: '7-day streak', color: '#F97316' },
  streak_30:   { icon: '💎', label: '30-day streak', color: '#60A5FA' },
  star_50:     { icon: '⭐', label: '50 stars', color: '#4ADE80' },
  star_100:    { icon: '🌠', label: '100 stars', color: '#A78BFA' },
  star_500:    { icon: '🌌', label: '500 stars', color: '#818CF8' },
  star_1000:   { icon: '🚀', label: '1,000 stars', color: '#F472B6' },
};
