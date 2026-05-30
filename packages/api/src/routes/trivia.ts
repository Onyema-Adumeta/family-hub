import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { broadcast } from '../services/websocket';

const router = Router();
const prisma = new PrismaClient();

// ── GET /api/trivia/current — get active or latest session for family
router.get('/current', async (req: AuthRequest, res) => {
  try {
    const session = await prisma.triviaSession.findFirst({
      where: { familyId: req.familyId! },
      orderBy: { createdAt: 'desc' },
      include: {
        questions: { orderBy: { order: 'asc' } },
        answers:   { include: { member: { select: { id: true, name: true, emoji: true, color: true } } } },
      },
    });
    res.json(session);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/trivia/generate — parent generates a new session (calls Claude)
router.post('/generate', async (req: AuthRequest, res) => {
  if (req.role !== 'parent') return res.status(403).json({ error: 'Parents only' });

  try {
    // Get family name for context
    const family = await prisma.family.findUnique({ where: { id: req.familyId! } });

    // Call Claude API to generate 10 trivia questions
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
]

Make sure the answer exactly matches one of the options. Make questions fun and engaging!`,
        }],
      }),
    });

    const aiData = await response.json() as any;
    const text = aiData.content?.[0]?.text || '[]';

    let questions: any[] = [];
    try {
      const clean = text.replace(/```json|```/g, '').trim();
      questions = JSON.parse(clean);
    } catch {
      return res.status(500).json({ error: 'Failed to parse AI questions' });
    }

    if (!questions.length) return res.status(500).json({ error: 'No questions generated' });

    // Create session + questions
    const session = await prisma.triviaSession.create({
      data: {
        familyId: req.familyId!,
        status: 'active',
        questions: {
          create: questions.slice(0, 10).map((q: any, i: number) => ({
            question: q.question,
            options:  q.options,
            answer:   q.answer,
            order:    i + 1,
          })),
        },
      },
      include: {
        questions: { orderBy: { order: 'asc' } },
        answers:   true,
      },
    });

    // Notify all family members
    await prisma.notification.create({
      data: {
        familyId: req.familyId!,
        title: '🎮 Trivia Night is live!',
        body: 'A new trivia session has started — join now and answer 10 questions!',
      },
    });

    // Broadcast via WebSocket
    broadcast(req.familyId!, { type: 'trivia:started', session });

    res.json(session);
  } catch (e: any) {
    console.error('Trivia generate error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/trivia/:sessionId/answer — submit an answer
router.post('/:sessionId/answer', async (req: AuthRequest, res) => {
  const { sessionId } = req.params;
  const { questionId, answer } = req.body;

  if (!questionId || !answer) return res.status(400).json({ error: 'questionId and answer required' });

  try {
    // Check session is active
    const session = await prisma.triviaSession.findUnique({ where: { id: sessionId } });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status !== 'active') return res.status(400).json({ error: 'Session is not active' });

    // Prevent duplicate answers
    const existing = await prisma.triviaAnswer.findFirst({
      where: { sessionId, questionId, memberId: req.memberId! },
    });
    if (existing) return res.status(400).json({ error: 'Already answered' });

    // Check if correct
    const question = await prisma.triviaQuestion.findUnique({ where: { id: questionId } });
    if (!question) return res.status(404).json({ error: 'Question not found' });
    const correct = answer === question.answer;

    const triviaAnswer = await prisma.triviaAnswer.create({
      data: { sessionId, questionId, memberId: req.memberId!, answer, correct },
      include: { member: { select: { id: true, name: true, emoji: true, color: true } } },
    });

    // Broadcast answer to family
    broadcast(req.familyId!, { type: 'trivia:answer', answer: triviaAnswer });

    res.json({ correct, answer: triviaAnswer });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/trivia/:sessionId/finish — parent finishes the session
router.post('/:sessionId/finish', async (req: AuthRequest, res) => {
  if (req.role !== 'parent') return res.status(403).json({ error: 'Parents only' });

  try {
    const session = await prisma.triviaSession.update({
      where: { id: req.params.sessionId },
      data:  { status: 'finished' },
      include: {
        questions: { orderBy: { order: 'asc' } },
        answers:   { include: { member: { select: { id: true, name: true, emoji: true, color: true } } } },
      },
    });

    // Calculate scores and award stars to winner
    const scores: Record<string, { member: any; correct: number }> = {};
    for (const answer of session.answers) {
      if (!scores[answer.memberId]) scores[answer.memberId] = { member: answer.member, correct: 0 };
      if (answer.correct) scores[answer.memberId].correct++;
    }

    const ranked = Object.values(scores).sort((a, b) => b.correct - a.correct);
    if (ranked.length > 0) {
      const winner = ranked[0];
      const bonusStars = 3;
      await prisma.member.update({
        where: { id: winner.member.id },
        data:  { stars: { increment: bonusStars } },
      });
      await prisma.notification.create({
        data: {
          familyId: req.familyId!,
          title: `🏆 ${winner.member.emoji} ${winner.member.name} wins trivia night!`,
          body: `${winner.member.name} got ${winner.correct}/${session.questions.length} correct and earned ${bonusStars} bonus ⭐!`,
        },
      });
    }

    broadcast(req.familyId!, { type: 'trivia:finished', session, scores: ranked });
    res.json({ session, scores: ranked });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── DELETE /api/trivia/:sessionId — parent deletes a session
router.delete('/:sessionId', async (req: AuthRequest, res) => {
  if (req.role !== 'parent') return res.status(403).json({ error: 'Parents only' });
  try {
    await prisma.triviaAnswer.deleteMany({ where: { sessionId: req.params.sessionId } });
    await prisma.triviaQuestion.deleteMany({ where: { sessionId: req.params.sessionId } });
    await prisma.triviaSession.delete({ where: { id: req.params.sessionId } });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;