import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BADGE_CHECKS: Array<{ badge: string; check: (m: any) => boolean }> = [
  { badge: 'first_chore', check: m => (m.totalChoresDone ?? 0) >= 1   },
  { badge: 'streak_7',    check: m => (m.streakDays    ?? 0) >= 7     },
  { badge: 'streak_30',   check: m => (m.streakDays    ?? 0) >= 30    },
  { badge: 'star_50',     check: m => (m.stars         ?? 0) >= 50    },
  { badge: 'star_100',    check: m => (m.stars         ?? 0) >= 100   },
];

export async function awardBadges(memberId: string) {
  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) return;

  const current: string[] = (member as any).badges ?? [];
  const toAdd = BADGE_CHECKS
    .filter(({ badge, check }) => !current.includes(badge) && check(member))
    .map(({ badge }) => badge);

  if (toAdd.length > 0) {
    await (prisma.member as any).update({
      where: { id: memberId },
      data:  { badges: [...current, ...toAdd] },
    });
    console.log(`[badges] Awarded ${toAdd.join(', ')} to ${memberId}`);
  }
}

export function startStreakCron() {
  // Runs at midnight every day
  cron.schedule('0 0 * * *', async () => {
    console.log('[streaks] Running daily streak check...');
    try {
      const members = await (prisma.member as any).findMany({
        select: {
          id:              true,
          streakDays:      true,
          streakUpdatedAt: true,
          totalChoresDone: true,
          stars:           true,
          badges:          true,
        },
      });

      const now       = new Date();
      const today     = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      for (const member of members) {
        // Check if member completed a chore today using completedAt field
        const doneToday = await prisma.chore.count({
          where: {
            assignedToId: member.id,
            status:       'done',
            completedAt:  { gte: today },  // ← use completedAt, not updatedAt
          } as any,
        });

        if (doneToday > 0) {
          const lastUpdate = member.streakUpdatedAt ? new Date(member.streakUpdatedAt) : null;
          const alreadyUpdatedToday = lastUpdate && lastUpdate >= today;
          if (!alreadyUpdatedToday) {
            const newStreak = (member.streakDays ?? 0) + 1;
            await (prisma.member as any).update({
              where: { id: member.id },
              data:  { streakDays: newStreak, streakUpdatedAt: now },
            });
            console.log(`[streaks] ${member.id} streak → ${newStreak}`);
            await awardBadges(member.id);
          }
        } else {
          // No chore done — check if streak should break
          const lastUpdate = member.streakUpdatedAt ? new Date(member.streakUpdatedAt) : null;
          const missedYesterday = !lastUpdate || lastUpdate < yesterday;
          if (missedYesterday && (member.streakDays ?? 0) > 0) {
            await (prisma.member as any).update({
              where: { id: member.id },
              data:  { streakDays: 0 },
            });
            console.log(`[streaks] ${member.id} streak reset`);
          }
        }
      }

      // Reset daily chores back to pending
      const { count } = await (prisma.chore as any).updateMany({
        where: { frequency: 'daily', status: 'done' },
        data:  { status: 'pending', completedAt: null, completedById: null },
      });
      console.log(`[streaks] Reset ${count} daily chores`);

    } catch (e) {
      console.error('[streaks] Cron error:', e);
    }
  });

  console.log('[streaks] Daily cron registered (midnight)');
}