import { Router } from 'express';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../db';
import { PUBLIC_FAMILY_SELECT, requireParent } from '../lib/guards';
import { audit } from '../services/audit';

const router = Router();

// GET /api/family — family settings safe for any member to see
router.get('/', async (req: AuthRequest, res) => {
  try {
    const family = await prisma.family.findUnique({
      where: { id: req.familyId },
      select: { ...PUBLIC_FAMILY_SELECT, aiConsentAt: true, googleTokens: true },
    });
    if (!family) return res.status(404).json({ error: 'Family not found' });
    const { googleTokens, aiConsentAt, ...rest } = family;
    res.json({
      ...rest,
      aiEnabled: !!aiConsentAt,
      aiConsentAt,
      aiConfigured: !!process.env.ANTHROPIC_API_KEY,
      googleConnected: !!googleTokens,
    });
  } catch { res.status(500).json({ error: 'Could not load family settings' }); }
});

// PUT /api/family/ai-consent — a parent switches AI features on or off.
// Turning it on is the parent's consent to sending anonymised family activity
// (no names, birthdays or exact ages) to the AI provider.
router.put('/ai-consent', async (req: AuthRequest, res) => {
  if (!requireParent(req, res)) return;
  const { enabled } = req.body || {};
  if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'enabled must be true or false' });
  try {
    const family = await prisma.family.update({
      where: { id: req.familyId },
      data: enabled ? { aiConsentAt: new Date(), aiConsentById: req.memberId } : { aiConsentAt: null, aiConsentById: null },
      select: { aiConsentAt: true },
    });
    await audit(req, enabled ? 'ai.enabled' : 'ai.disabled', enabled ? 'turned AI features on' : 'turned AI features off', { type: 'family', id: req.familyId });
    res.json({ aiEnabled: !!family.aiConsentAt, aiConsentAt: family.aiConsentAt });
  } catch { res.status(500).json({ error: 'Could not save AI setting' }); }
});

// GET /api/family/audit — recent activity (parents only)
router.get('/audit', async (req: AuthRequest, res) => {
  if (!requireParent(req, res)) return;
  const take = Math.min(Math.max(parseInt(String(req.query.limit || '100'), 10) || 100, 1), 500);
  try {
    const entries = await prisma.auditLog.findMany({
      where: { familyId: req.familyId },
      orderBy: { createdAt: 'desc' },
      take,
      select: { id: true, actorId: true, actorName: true, action: true, targetType: true, targetId: true, summary: true, createdAt: true },
    });
    res.json(entries);
  } catch { res.status(500).json({ error: 'Could not load activity' }); }
});

export default router;
