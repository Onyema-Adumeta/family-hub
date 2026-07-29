import { Router } from 'express';
import { prisma } from '../db';
import { AuthRequest, authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// POST /api/games/score — record a completed game round
router.post('/score', async (req: AuthRequest, res) => {
  try {
    const { gameType, score } = req.body;
    if (!gameType || typeof score !== 'number') {
      return res.status(400).json({ error: 'gameType and numeric score required' });
    }
    const saved = await prisma.gameScore.create({
      data: {
        familyId: req.familyId!,
        memberId: req.memberId!,
        gameType,
        score,
      },
    });
    res.json(saved);
  } catch (e) {
    console.error('[games] score save error:', e);
    res.status(500).json({ error: 'Failed to save score' });
  }
});

// GET /api/games/leaderboard?gameType=memory — top scores per family
router.get('/leaderboard', async (req: AuthRequest, res) => {
  try {
    const { gameType } = req.query;
    const scores = await prisma.gameScore.findMany({
      where: {
        familyId: req.familyId!,
        ...(gameType ? { gameType: String(gameType) } : {}),
      },
      orderBy: { score: 'desc' },
      take: 20,
      include: { member: { select: { id: true, name: true, emoji: true, color: true } } },
    });
    res.json(scores);
  } catch (e) {
    console.error('[games] leaderboard error:', e);
    res.status(500).json({ error: 'Failed to load leaderboard' });
  }
});

export default router;