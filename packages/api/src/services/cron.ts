import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

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

    // Call Claude to generate questions
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: `Generate 10 challenging trivia questions for the ${family.name} family.
Mix of: history, science, geography, literature, math puzzles, and tricky general knowledge.
Make them genuinely difficult — questions that require real thought, not just guessing.
Avoid overly simple questions. Aim for a difficulty level that would challenge teens and adults.
Use a different set of topics than yesterday — keep it fresh and varied.

Respond with ONLY a valid JSON array, no markdown, no explanation:
[
  {
    "question": "Question text here?",
    "options": ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"],
    "answer": "A) Option 1"
  }
]`,
        }],
      }),
    });

    const aiData = await response.json() as any;
    const text = aiData.content?.[0]?.text || '[]';
    let questions: any[] = [];
    try {
      questions = JSON.parse(text.replace(/```json|```/g, '').trim());
    } catch { continue; }
    if (!questions.length) continue;

    await prisma.triviaSession.create({
      data: {
        familyId: family.id,
        status: 'active',
        questions: {
          create: questions.slice(0, 10).map((q: any, i: number) => ({
            question: q.question,
            options: q.options,
            answer: q.answer,
            order: i + 1,
          })),
        },
      },
    });

    await prisma.notification.create({
      data: {
        familyId: family.id,
        title: '🎮 Daily Trivia is ready!',
        body: `Today's 10 questions are live — can you beat the family?`,
      },
    });

    console.log(`[trivia] Generated daily session for family ${family.name}`);
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