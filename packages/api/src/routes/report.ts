import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';

const router = Router();
import { prisma } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function getWeekStart() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// GET /api/report Ã¢â‚¬â€ full weekly report with AI insights
router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const familyId = req.familyId;
    if (!familyId) return res.status(401).json({ error: 'Unauthorized' });

    const weekStart = getWeekStart();
    const weekEnd   = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    // Ã¢â€â‚¬Ã¢â€â‚¬ Fetch all data in parallel Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    const [members, allChores, completedThisWeek, messages, meals] = await Promise.all([
      prisma.member.findMany({
        where: { familyId },
        select: { id: true, name: true, emoji: true, color: true, stars: true, streakDays: true, badges: true, totalChoresDone: true }
      }),
      prisma.chore.findMany({
        where: { familyId },
        select: { id: true, title: true, status: true, stars: true, assignedToId: true, completedById: true, completedAt: true, emoji: true }
      }),
      prisma.chore.findMany({
        where: {
          familyId,
          status: 'done',
          completedAt: { gte: weekStart, lt: weekEnd }
        },
        select: { id: true, title: true, stars: true, completedById: true, completedAt: true, emoji: true }
      }),
      prisma.message.findMany({
        where: { familyId, createdAt: { gte: weekStart } },
        select: { id: true, memberId: true }
      }),
      prisma.meal.findMany({
        where: { familyId, createdAt: { gte: weekStart } },
        select: { id: true, name: true, day: true, slot: true }
      }),
    ]);

    // Ã¢â€â‚¬Ã¢â€â‚¬ Compute per-member stats Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    const memberStats = members.map(m => {
      const assigned  = allChores.filter(c => c.assignedToId === m.id);
      const doneThisWeek = completedThisWeek.filter(c => c.completedById === m.id);
      const starsEarned  = doneThisWeek.reduce((sum, c) => sum + (c.stars || 0), 0);
      const msgCount     = messages.filter(msg => msg.memberId === m.id).length;
      const completionPct = assigned.length > 0
        ? Math.round((assigned.filter(c => c.status === 'done').length / assigned.length) * 100)
        : 0;
      return {
        ...m,
        assigned: assigned.length,
        doneThisWeek: doneThisWeek.length,
        starsEarned,
        msgCount,
        completionPct,
      };
    });

    // Ã¢â€â‚¬Ã¢â€â‚¬ Overall family stats Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    const totalChores    = allChores.length;
    const doneChores     = allChores.filter(c => c.status === 'done').length;
    const familyPct      = totalChores > 0 ? Math.round((doneChores / totalChores) * 100) : 0;
    const totalStarsWeek = completedThisWeek.reduce((s, c) => s + (c.stars || 0), 0);
    const topMember      = [...memberStats].sort((a, b) => b.starsEarned - a.starsEarned)[0];
    const streakLeader   = [...memberStats].sort((a, b) => (b.streakDays || 0) - (a.streakDays || 0))[0];
    const mealsPlanned   = meals.length;

    // Ã¢â€â‚¬Ã¢â€â‚¬ AI Insights from Claude Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    let aiInsights = '';
    let aiTips: string[] = [];

    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const prompt = `You are a warm, encouraging family coach. Based on this week's Family Hub data, give 3 short actionable parenting tips and a brief family summary.

Family stats this week:
- Overall chore completion: ${familyPct}%
- Total stars earned: ${totalStarsWeek}
- Meals planned: ${mealsPlanned}/7
- Messages sent: ${messages.length}

Member breakdown:
${memberStats.map(m => `- ${m.name}: ${m.doneThisWeek} chores done, ${m.starsEarned} stars earned, ${m.streakDays || 0} day streak`).join('\n')}

Top performer: ${topMember?.name || 'N/A'}
Streak leader: ${streakLeader?.name || 'N/A'} (${streakLeader?.streakDays || 0} days)

Respond in JSON format only, no markdown:
{
  "summary": "2-3 sentence warm family summary",
  "tips": ["tip 1", "tip 2", "tip 3"],
  "encouragement": "one sentence of encouragement for the whole family"
}`;

        const response = await anthropic.messages.create({
          model: 'claude-opus-4-5',
          max_tokens: 500,
          messages: [{ role: 'user', content: prompt }]
        });

        const text = response.content[0].type === 'text' ? response.content[0].text : '';
        const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
        aiInsights = parsed.summary || '';
        aiTips     = parsed.tips || [];
        if (parsed.encouragement) aiTips.push(parsed.encouragement);
      } catch (e) {
        aiInsights = `Your family completed ${familyPct}% of chores this week. ${topMember ? `${topMember.name} led the way with ${topMember.starsEarned} stars!` : ''} Keep building those good habits!`;
        aiTips = [
          'Celebrate small wins Ã¢â‚¬â€ even one completed chore deserves recognition.',
          'Consistency beats perfection. A daily routine builds lasting habits.',
          'Let kids choose their own chores sometimes Ã¢â‚¬â€ ownership increases motivation.',
        ];
      }
    } else {
      aiInsights = `Your family completed ${familyPct}% of chores this week. ${topMember ? `${topMember.name} led the way!` : ''} Great effort all around!`;
      aiTips = [
        'Celebrate small wins Ã¢â‚¬â€ even one completed chore deserves recognition.',
        'Consistency beats perfection. A daily routine builds lasting habits.',
        'Let kids choose their own chores sometimes Ã¢â‚¬â€ ownership increases motivation.',
      ];
    }

    res.json({
      week: { start: weekStart.toISOString(), end: weekEnd.toISOString() },
      family: {
        totalChores,
        doneChores,
        familyPct,
        totalStarsWeek,
        mealsPlanned,
        messagesCount: messages.length,
      },
      memberStats,
      topMember,
      streakLeader,
      recentCompleted: completedThisWeek.slice(0, 10),
      ai: { summary: aiInsights, tips: aiTips },
    });

  } catch (e: any) {
    console.error('Report error:', e);
    res.status(500).json({ error: e.message });
  }
});

export default router;