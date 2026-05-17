import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

  console.log('⏰ Cron jobs scheduled');
}