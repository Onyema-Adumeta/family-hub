import { Router } from 'express';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../db';
import { PUBLIC_FAMILY_SELECT, requireParent } from '../lib/guards';
import { audit } from '../services/audit';
import bcrypt from 'bcryptjs';
import { TERMS_VERSION } from '../lib/legal';
import { deleteFamilyData, exportFamilyData } from '../services/familyData';
import { emailConfigured } from '../services/mailer';

// A parent confirms their own password before exporting or deleting family data.
async function passwordOk(req: AuthRequest) {
  const me = await prisma.member.findUnique({ where: { id: req.memberId }, select: { password: true } });
  const given = typeof req.body?.password === 'string' ? req.body.password : '';
  return !!me?.password && (await bcrypt.compare(given, me.password));
}

const router = Router();

// GET /api/family — family settings safe for any member to see
router.get('/', async (req: AuthRequest, res) => {
  try {
    const family = await prisma.family.findUnique({
      where: { id: req.familyId },
      select: { ...PUBLIC_FAMILY_SELECT, aiConsentAt: true, googleTokens: true, termsAcceptedAt: true, termsVersion: true, childConsentAt: true },
    });
    if (!family) return res.status(404).json({ error: 'Family not found' });
    const { googleTokens, aiConsentAt, termsAcceptedAt, termsVersion, childConsentAt, ...rest } = family;
    res.json({
      ...rest,
      planLabel: 'Free beta',
      termsAcceptedAt,
      termsVersion,
      currentTermsVersion: TERMS_VERSION,
      needsConsent: termsVersion !== TERMS_VERSION || !childConsentAt,
      emailAvailable: emailConfigured(),
      supportEmail: process.env.SUPPORT_EMAIL || null,
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

// POST /api/family/consent — a parent accepts the current Terms and Privacy
// Policy and consents to the collection of their children's information.
router.post('/consent', async (req: AuthRequest, res) => {
  if (!requireParent(req, res)) return;
  if (req.body?.acceptTerms !== true || req.body?.childDataConsent !== true) {
    return res.status(400).json({ error: 'Both boxes need to be ticked to continue' });
  }
  try {
    const now = new Date();
    await prisma.family.update({
      where: { id: req.familyId },
      data: { termsAcceptedAt: now, termsVersion: TERMS_VERSION, termsAcceptedById: req.memberId, childConsentAt: now },
    });
    await audit(req, 'family.consent', `accepted the terms and privacy policy (${TERMS_VERSION}) and gave consent for the children`, { type: 'family', id: req.familyId });
    res.json({ ok: true, termsVersion: TERMS_VERSION });
  } catch { res.status(500).json({ error: 'Could not save' }); }
});

// POST /api/family/export — download everything we hold about the family (parents)
router.post('/export', async (req: AuthRequest, res) => {
  if (!requireParent(req, res)) return;
  if (!(await passwordOk(req))) return res.status(400).json({ error: 'Password is incorrect' });
  try {
    const data = await exportFamilyData(req.familyId!);
    await audit(req, 'family.exported', 'downloaded a copy of the family data', { type: 'family', id: req.familyId });
    res.setHeader('Content-Disposition', `attachment; filename="kinroost-export-${new Date().toISOString().slice(0, 10)}.json"`);
    res.json(data);
  } catch (e) { console.error('export failed', e); res.status(500).json({ error: 'Could not export data' }); }
});

// POST /api/family/delete — permanently delete the family and all its data (parents).
// Requires the parent's password and the family name typed exactly.
router.post('/delete', async (req: AuthRequest, res) => {
  if (!requireParent(req, res)) return;
  try {
    const family = await prisma.family.findUniqueOrThrow({ where: { id: req.familyId }, select: { name: true } });
    if (!(await passwordOk(req))) return res.status(400).json({ error: 'Password is incorrect' });
    if (typeof req.body?.confirmName !== 'string' || req.body.confirmName.trim() !== family.name.trim()) {
      return res.status(400).json({ error: `Type the family name exactly: ${family.name}` });
    }
    await deleteFamilyData(req.familyId!);
    console.log(`[family] deleted family ${req.familyId} at the request of member ${req.memberId}`);
    res.json({ ok: true, deleted: true });
  } catch (e) { console.error('delete failed', e); res.status(500).json({ error: 'Could not delete the family. Nothing was deleted.' }); }
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
