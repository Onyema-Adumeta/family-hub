import cron from 'node-cron';
import { prisma } from '../db';
import { generateTriviaSession } from '../routes/trivia';

async function generateDailyTrivia() {
  const families = await prisma.family.findMany({ select: { id: true, name: true } });
  for (const family of families) {
    // Check if a session already exists for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const existing = await prisma.triviaSession.findFirst({
      where: { familyId: family.id, createdAt: { gte: today } },
    });
    if (existing) continue;

    const result = await generateTriviaSession(family.id);

    if ('error' in result) {
      console.error(`[trivia] Generation failed for family ${family.name}:`, result.error);
      continue;
    }

    console.log(`[trivia] Generated daily "${result.categoryName}" session for family ${family.name}`);
  }
}

export function setupCron() {
  // Reset daily chores at midnight
  cron.schedule('0 0 * * *', async () => {
    console.log('Resetting daily chores...');
    await prisma.chore.updateMany({
      where: { frequency: 'daily' },
      data: { status: 'pending', completedAt: null, completedById: null }
    });
  });

  // Morning reminder notification at 8am
  cron.schedule('0 8 * * *', async () => {
    const families = await prisma.family.findMany({ select: { id: true, name: true } });
    for (const family of families) {
      const pending = await prisma.chore.count({
        where: { familyId: family.id, status: 'pending', frequency: 'daily' }
      });
      if (pending > 0) {
        await prisma.notification.create({
          data: {
            familyId: family.id,
            title: '🌅 Good morning!',
            body: `${pending} chore${pending > 1 ? 's' : ''} to do today. Let's crush it! ⭐`
          }
        });
      }
    }
  });

  // Weekly reset on Sunday midnight
  cron.schedule('0 0 * * 0', async () => {
    await prisma.chore.updateMany({
      where: { frequency: 'weekly' },
      data: { status: 'pending', completedAt: null, completedById: null }
    });
  });

  // Daily trivia generation at 6am
  cron.schedule('0 6 * * *', async () => {
    console.log('[trivia] Generating daily trivia sessions...');
    await generateDailyTrivia().catch(e => console.error('[trivia] cron error:', e));
  });

  console.log('⏰ Cron jobs scheduled');
}