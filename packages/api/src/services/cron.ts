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
          content: `Generate 10 trivia questions for a family with a 10-year-old, a 14-year-old, and 2 adults.
Mix difficulty like this:
- 3 easy questions (10-year-old level: animals, basic science, Disney/Pixar, superheroes, Minecraft, fun world records)
- 4 medium questions (14-year-old level: history, geography, music, movies/TV, sports, technology, pop culture)
- 3 hard questions (adult level: literature, advanced science, world history, Canadian geography, cooking, 80s/90s nostalgia, tricky logic)
Make sure every family member gets to shine at least once. Keep all content family-friendly.
Use a completely different mix of topics each time — never repeat the same questions.

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

    // --- TEMP DIAGNOSTIC: surface what Anthropic actually returned ---
    if (!aiData.content || !aiData.content[0]?.text) {
      console.error('Anthropic returned no content. Full response:', JSON.stringify(aiData));
      return res.status(500).json({
        error: aiData.error?.message || aiData.type || 'AI returned no content',
        raw: aiData.error || aiData,
      });
    }
    // ----------------------------------------------------------------

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