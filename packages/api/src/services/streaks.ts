import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function awardBadges(memberId: string) {
  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) return;

  const badges = new Set<string>(member.badges || []);
  const newBadges: string[] = [];

  if (member.totalChoresDone >= 1  && !badges.has('first_chore')) { badges.add('first_chore'); newBadges.push('first_chore'); }
  if ((member.streakDays ?? 0) >= 7  && !badges.has('streak_7'))  { badges.add('streak_7');   newBadges.push('streak_7');   }
  if ((member.streakDays ?? 0) >= 30 && !badges.has('streak_30')) { badges.add('streak_30');  newBadges.push('streak_30');  }
  if (member.stars >= 50  && !badges.has('star_50'))  { badges.add('star_50');  newBadges.push('star_50');  }
  if (member.stars >= 100 && !badges.has('star_100')) { badges.add('star_100'); newBadges.push('star_100'); }

  if (newBadges.length > 0) {
    await prisma.member.update({ where: { id: memberId }, data: { badges: [...badges] } });
    for (const badge of newBadges) {
      const labels: Record<string, string> = {
        first_chore: '🌟 First Chore completed!',
        streak_7:    '🔥 7-day streak — incredible!',
        streak_30:   '💎 30-day streak — legendary!',
        star_50:     '⭐ 50 Stars earned!',
        star_100:    '🌠 100 Stars — amazing!',
      };
      await prisma.notification.create({
        data: {
          familyId: member.familyId,
          memberId,
          title: '🏅 New Badge!',
          body: labels[badge] || badge,
          read: false,
        },
      });
    }
  }
}

export function startStreakCron() {
  // ── Midnight: reset daily chores + update member streaks ──────────────────
  cron.schedule('0 0 * * *', async () => {
    console.log('[streaks] Running midnight cron...');
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      const families = await prisma.family.findMany({ include: { members: true } });

      for (const family of families) {
        for (const member of family.members) {
          const lastUpdate = member.streakUpdatedAt ? new Date(member.streakUpdatedAt) : null;
          const missedYesterday = !lastUpdate || lastUpdate < yesterday;

          if (missedYesterday && (member.streakDays ?? 0) > 0) {
            await prisma.member.update({
              where: { id: member.id },
              data: { streakDays: 0 },
            });
            console.log(`[streaks] ${member.name} streak reset (missed)`);
          }
        }
      }

      // Reset daily chores back to pending
      const { count } = await prisma.chore.updateMany({
        where: { frequency: 'daily', status: 'done' },
        data: { status: 'pending', completedAt: null, completedById: null },
      });
      console.log(`[streaks] Reset ${count} daily chores to pending`);

    } catch (e) {
      console.error('[streaks] Cron error:', e);
    }
  });

  // ── Weekly recurring chores: advance dueDate after completion ─────────────
  // Runs every day at 00:05 — finds recurring weekly chores that are done
  // and advances their dueDate by 7 days (so they reset for next week).
  // Missed ones are left overdue and carried forward (not reset).
  cron.schedule('5 0 * * *', async () => {
    console.log('[streaks] Processing weekly recurring chores...');
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Find all recurring weekly chores that are DONE
      const doneRecurring = await prisma.chore.findMany({
        where: {
          frequency: 'weekly',
          recurring: true,
          status: 'done',
        },
      });

      for (const chore of doneRecurring) {
        // Advance dueDate by 7 days from its current dueDate (or today if none)
        const base = chore.dueDate ? new Date(chore.dueDate) : today;
        const nextDue = new Date(base);
        nextDue.setDate(base.getDate() + 7);

        // Increment weeklyStreak, reset status to pending for next week
        await prisma.chore.update({
          where: { id: chore.id },
          data: {
            status: 'pending',
            completedAt: null,
            completedById: null,
            dueDate: nextDue,
            weeklyStreak: { increment: 1 },
          },
        });

        console.log(`[streaks] Advanced recurring chore "${chore.title}" → due ${nextDue.toISOString().slice(0, 10)}, streak now ${(chore.weeklyStreak ?? 0) + 1}`);
      }

      // Overdue recurring chores (not done, dueDate in the past) — leave as-is (carry forward)
      // Just log them so parents can see in Railway logs
      const overdue = await prisma.chore.findMany({
        where: {
          frequency: 'weekly',
          recurring: true,
          status: { not: 'done' },
          dueDate: { lt: today },
        },
        select: { id: true, title: true, dueDate: true },
      });

      if (overdue.length > 0) {
        console.log(`[streaks] ${overdue.length} overdue recurring chore(s) carried forward:`, overdue.map(c => c.title).join(', '));
      }

    } catch (e) {
      console.error('[streaks] Weekly recurring error:', e);
    }
  });

  console.log('[streaks] Cron registered (midnight daily + 00:05 weekly recurring)');
}

export { awardBadges as default };