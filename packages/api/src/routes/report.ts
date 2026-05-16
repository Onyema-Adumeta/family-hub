import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import Anthropic from '@anthropic-ai/sdk';

const router = Router();
const prisma = new PrismaClient();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

router.get('/weekly', async (req: AuthRequest, res) => {
  try {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [completedChores, members, quests] = await Promise.all([
      prisma.chore.findMany({ where: { familyId: req.familyId, done: true, completedAt: { gte: oneWeekAgo } }, include: { completedBy: true } }),
      prisma.member.findMany({ where: { familyId: req.familyId }, select: { id: true, name: true, emoji: true, color: true, role: true, stars: true } }),
      prisma.quest.findMany({ where: { familyId: req.familyId, completed: true, completedAt: { gte: oneWeekAgo } } })
    ]);

    const starsByMember: Record<string, number> = {};
    for (const chore of completedChores) {
      if (chore.completedById) {
        starsByMember[chore.completedById] = (starsByMember[chore.completedById] || 0) + chore.stars;
      }
    }

    const topMemberId = Object.entries(starsByMember).sort((a, b) => b[1] - a[1])[0]?.[0];
    const topMember = members.find(m => m.id === topMemberId);
    const totalStars = Object.values(starsByMember).reduce((a, b) => a + b, 0);

    // Generate AI summary
    let aiSummary = '';
    if (process.env.ANTHROPIC_API_KEY && completedChores.length > 0) {
      try {
        const msg = await anthropic.messages.create({
          model: 'claude-3-haiku-20240307',
          max_tokens: 200,
          messages: [{
            role: 'user',
            content: `Write a fun, encouraging 2-sentence weekly family report. ${completedChores.length} chores completed, ${totalStars} stars earned. Top performer: ${topMember?.name || 'everyone'}. ${quests.length} quests completed. Keep it kid-friendly and celebratory!`
          }]
        });
        aiSummary = (msg.content[0] as any).text;
      } catch { /* AI optional */ }
    }

    res.json({
      week: oneWeekAgo.toISOString(),
      choresCompleted: completedChores.length,
      totalStars,
      topMember,
      questsCompleted: quests.length,
      highlights: completedChores.slice(0, 5).map(c => `${c.emoji || '✅'} ${c.title}`),
      aiSummary,
      memberStats: members.map(m => ({ ...m, weeklyStars: starsByMember[m.id] || 0 }))
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
