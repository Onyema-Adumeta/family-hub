import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BADGES = {
  first_chore: (m: any) => (m.totalChoresDone ?? 0) >= 1,
  streak_7:    (m: any) => (m.streakDays ?? 0) >= 7,
  streak_30:   (m: any) => (m.streakDays ?? 0) >= 30,
  star_50:     (m: any) => (m.stars ?? 0) >= 50,
  star_100:    (m: any) => (m.stars ?? 0) >= 100,
};

async function awardBadges(memberId: string) {
  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) return;

  const current: string[] = (member as any).badges ?? [];
  const toAdd: string[] = [];

  for (const [badge, check] of Object.entries(BADGES)) {
    if (!current.includes(badge) && check(member)) {
      toAdd.push(badge);
    }
  }

  if (toAdd.length > 0) {
    await prisma.member.update({
      where: { id: memberId },
      data:  { badges: [...current, ...toAdd] },
    });
    console.log(`[badges] Awarded ${toAdd.join(', ')} to member ${memberId}`);
  }
}

// Runs at midnight every day
export function startStreakCron() {
  cron.schedule('0 0 * * *', async () => {
    console.log('[streaks] Running daily streak check...');
    try {
      const members = await prisma.member.findMany({
        select: {
          id: true,
          streakDays: true,
          streakUpdatedAt: true,
          totalChoresDone: true,
          stars: true,
          badges: true,
        },
      });

      const now   = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);

      for (const member of members) {
        // Check if member completed a chore today (done in the last 24h)
        const doneToday = await prisma.chore.count({
          where: {
            assignedToId: member.id,
            status:       'done',
            updatedAt:    { gte: today },
          },
        });

        if (doneToday > 0) {
          // ✅ Completed a chore today — increment streak
          const lastUpdate = member.streakUpdatedAt ? new Date(member.streakUpdatedAt) : null;
          const alreadyUpdatedToday = lastUpdate && lastUpdate >= today;

          if (!alreadyUpdatedToday) {
            const newStreak = (member.streakDays ?? 0) + 1;
            await prisma.member.update({
              where: { id: member.id },
              data:  { streakDays: newStreak, streakUpdatedAt: now },
            });
            console.log(`[streaks] ${member.id} streak → ${newStreak}`);
            await awardBadges(member.id);
          }
        } else {
          // ❌ No chore done today — check if streak should break
          const lastUpdate = member.streakUpdatedAt ? new Date(member.streakUpdatedAt) : null;
          const missedYesterday = !lastUpdate || lastUpdate < yesterday;

          if (missedYesterday && (member.streakDays ?? 0) > 0) {
            await prisma.member.update({
              where: { id: member.id },
              data:  { streakDays: 0 },
            });
            console.log(`[streaks] ${member.id} streak reset (missed)`);
          }
        }
      }

      // Reset daily chores back to pending
      const { count } = await prisma.chore.updateMany({
        where: { frequency: 'daily', status: 'done' },
        data:  { status: 'pending', completedAt: null, completedById: null },
      });
      console.log(`[streaks] Reset ${count} daily chores to pending`);

    } catch (e) {
      console.error('[streaks] Cron error:', e);
    }
  });

  console.log('[streaks] Daily streak cron registered (runs at midnight)');
}

// Also export so it can be called manually from a route (for testing)
export { awardBadges };