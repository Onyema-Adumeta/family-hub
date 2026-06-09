import { Router } from 'express';
import { AuthRequest } from '../middleware/auth';
import { broadcast } from '../services/websocket';

const router = Router();
import { prisma } from '../db';

const CATEGORY_PACKS = [
  {
    name: 'Science & Nature',
    easy:   'animals, nature, weather, the human body, space basics',
    medium: 'biology, chemistry basics, physics, famous scientists, environment',
    hard:   'advanced science, chemistry, physics formulas, space exploration history',
  },
  {
    name: 'Pop Culture & Entertainment',
    easy:   'Disney/Pixar movies, superheroes, Minecraft, popular cartoons, kids TV shows',
    medium: 'movies, music artists, TV shows, video games, sports stars',
    hard:   '80s/90s nostalgia, classic films, music history, award shows, vintage pop culture',
  },
  {
    name: 'History & Geography',
    easy:   'world capitals, Canadian provinces, famous landmarks, national flags, continents',
    medium: 'world history events, Canadian history, geography, famous leaders, wars',
    hard:   'ancient civilizations, detailed world history, political history, treaties, revolutions',
  },
  {
    name: 'Food, Sports & Life',
    easy:   'common foods, basic sports rules, Olympic sports, fun food facts',
    medium: 'cooking techniques, sports records, nutrition, famous athletes, team sports',
    hard:   'advanced cooking, culinary terms, sports statistics, world records, nutrition science',
  },
  {
    name: 'Math, Logic & Language',
    easy:   'basic math, simple word puzzles, rhyming words, number fun facts',
    medium: 'math problems, word origins, grammar, riddles, logic puzzles',
    hard:   'advanced math, tricky logic puzzles, etymology, literature quotes, brain teasers',
  },
  {
    name: 'Mixed Bag',
    easy:   'fun world records, weird animal facts, silly science, toy history, popular games',
    medium: 'inventions, technology history, social media, internet culture, trending topics',
    hard:   'philosophy, economics basics, law trivia, architecture, world religions',
  },
];

function getAgeLabel(birthday: Date | null): string {
  if (!birthday) return 'unknown age';
  const age = Math.floor((Date.now() - birthday.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  if (age < 7)  return ${age}-year-old (very young child);
  if (age < 11) return ${age}-year-old (young child);
  if (age < 14) return ${age}-year-old (preteen);
  if (age < 18) return ${age}-year-old (teenager);
  return ${age}-year-old (adult);
}

// ── GET /api/trivia/current ───────────────────────────────────────────────────
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

// ── POST /api/trivia/generate ─────────────────────────────────────────────────
router.post('/generate', async (req: AuthRequest, res) => {
  if (req.role !== 'parent') return res.status(403).json({ error: 'Parents only' });

  try {
    const members = await prisma.member.findMany({
      where: { familyId: req.familyId! },
      select: { name: true, role: true, birthday: true },
    });

    const memberDescriptions = members.map(m =>
      ${m.name} ()
    ).join(', ');

    const kids   = members.filter(m => m.role === 'child');
    const adults = members.filter(m => m.role === 'parent');
    const hasYoungKids = kids.some(m => {
      if (!m.birthday) return false;
      const age = Math.floor((Date.now() - m.birthday.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      return age < 11;
    });
    const hasTeens = kids.some(m => {
      if (!m.birthday) return false;
      const age = Math.floor((Date.now() - m.birthday.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      return age >= 11 && age < 18;
    });

    let easyCount = 2, mediumCount = 4, hardCount = 4;
    if (hasYoungKids)  { easyCount = 4; mediumCount = 4; hardCount = 2; }
    else if (hasTeens) { easyCount = 2; mediumCount = 5; hardCount = 3; }
    if (adults.length === 0) { hardCount = Math.max(1, hardCount - 1); easyCount++; }

    const sessionCount = await prisma.triviaSession.count({ where: { familyId: req.familyId! } });
    const pack = CATEGORY_PACKS[sessionCount % CATEGORY_PACKS.length];

    const lastSession = await prisma.triviaSession.findFirst({
      where: { familyId: req.familyId! },
      orderBy: { createdAt: 'desc' },
      include: { questions: { select: { question: true } } },
    });
    const recentQuestions = lastSession?.questions.map(q => - ).join('\n') || 'None';

    const prompt = Generate 10 trivia questions for a family game night.

Family members: 

Today's category theme: 

Difficulty breakdown:
-  EASY questions — topics: 
-  MEDIUM questions — topics: 
-  HARD questions — topics: 

Rules:
1. Tailor question difficulty so every family member can answer at least 1-2 questions correctly
2. Make questions fun, engaging, and family-friendly
3. Vary the question format — some factual, some "which of these", some "who was the first to..."
4. DO NOT repeat any of these recent questions:


Respond with ONLY a valid JSON array, no markdown, no explanation:
[
  {
    "question": "Question text here?",
    "options": ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"],
    "answer": "A) Option 1",
    "difficulty": "easy"
  }
]

Make sure the answer exactly matches one of the options.;

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
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const aiData = await response.json() as any;
    const text = aiData.content?.[0]?.text || '[]';

    let questions: any[] = [];
    try {
      const clean = text.replace(/`json|`/g, '').trim();
      questions = JSON.parse(clean);
    } catch {
      return res.status(500).json({ error: 'Failed to parse AI questions' });
    }

    if (!questions.length) return res.status(500).json({ error: 'No questions generated' });

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

    await prisma.notification.create({
      data: {
        familyId: req.familyId!,
        title: 🎮 Trivia Night — !,
        body: A new  trivia session has started — join now and answer 10 questions!,
      },
    });

    broadcast(req.familyId!, { type: 'trivia:started', session });
    res.json({ ...session, categoryName: pack.name });
  } catch (e: any) {
    console.error('Trivia generate error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/trivia/:sessionId/answer ────────────────────────────────────────
router.post('/:sessionId/answer', async (req: AuthRequest, res) => {
  const { sessionId } = req.params;
  const { questionId, answer } = req.body;

  if (!questionId || !answer) return res.status(400).json({ error: 'questionId and answer required' });

  try {
    const session = await prisma.triviaSession.findUnique({ where: { id: sessionId } });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status !== 'active') return res.status(400).json({ error: 'Session is not active' });

    const existing = await prisma.triviaAnswer.findFirst({
      where: { sessionId, questionId, memberId: req.memberId! },
    });
    if (existing) return res.status(400).json({ error: 'Already answered' });

    const question = await prisma.triviaQuestion.findUnique({ where: { id: questionId } });
    if (!question) return res.status(404).json({ error: 'Question not found' });
    const correct = answer === question.answer;

    const triviaAnswer = await prisma.triviaAnswer.create({
      data: { sessionId, questionId, memberId: req.memberId!, answer, correct },
      include: { member: { select: { id: true, name: true, emoji: true, color: true } } },
    });

    broadcast(req.familyId!, { type: 'trivia:answer', answer: triviaAnswer });
    res.json({ correct, answer: triviaAnswer });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/trivia/:sessionId/finish ────────────────────────────────────────
// Parents can finish at any time. Members can finish if they've answered all questions.
router.post('/:sessionId/finish', async (req: AuthRequest, res) => {
  try {
    const sessionWithQuestions = await prisma.triviaSession.findUnique({
      where: { id: req.params.sessionId },
      include: {
        questions: true,
        answers: { include: { member: { select: { id: true, name: true, emoji: true, color: true } } } },
      },
    });

    if (!sessionWithQuestions) return res.status(404).json({ error: 'Session not found' });
    if (sessionWithQuestions.status !== 'active') return res.status(400).json({ error: 'Session already finished' });

    // Non-parents can only finish if they've personally answered all questions
    if (req.role !== 'parent') {
      const myAnswerCount = sessionWithQuestions.answers.filter(a => a.memberId === req.memberId).length;
      const totalQuestions = sessionWithQuestions.questions.length;
      if (myAnswerCount < totalQuestions) {
        return res.status(403).json({ error: 'Answer all questions before finishing' });
      }
    }

    const session = await prisma.triviaSession.update({
      where: { id: req.params.sessionId },
      data:  { status: 'finished' },
      include: {
        questions: { orderBy: { order: 'asc' } },
        answers:   { include: { member: { select: { id: true, name: true, emoji: true, color: true } } } },
      },
    });

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
          title: 🏆   wins trivia night!,
          body: ${winner.member.name} got / correct and earned  bonus ⭐!,
        },
      });
    }

    broadcast(req.familyId!, { type: 'trivia:finished', session, scores: ranked });
    res.json({ session, scores: ranked });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── DELETE /api/trivia/:sessionId ─────────────────────────────────────────────
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