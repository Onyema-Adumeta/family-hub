// Stars to real value: a screen-time bank and an allowance bank.
// This is a record-keeping ledger only. FamilyHub never holds or moves money;
// the parent gives the real money or screen time and records it here.
import { Router } from 'express';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../db';
import { memberInFamily, requireParent } from '../lib/guards';
import { audit } from '../services/audit';
import { notifyMember, notifyParents } from '../services/notify';
import { broadcast } from '../services/websocket';

const router = Router();
const BUCKETS = ['spend', 'save', 'give'] as const;
type Bucket = typeof BUCKETS[number];

export function money(cents: number, currency = 'CAD') {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency }).format(cents / 100);
}
const minutes = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60 ? `${m % 60} min` : ''}`.trim() : `${m} min`);

async function balances(familyId: string, memberIds: string[]) {
  const rows = await prisma.bankEntry.groupBy({
    by: ['memberId', 'kind', 'bucket'],
    where: { familyId, memberId: { in: memberIds } },
    _sum: { amount: true },
  });
  return memberIds.map(id => {
    const get = (kind: string, bucket: string | null) => rows.find(r => r.memberId === id && r.kind === kind && r.bucket === bucket)?._sum.amount || 0;
    return {
      memberId: id,
      screenMinutes: get('screen', null),
      money: { spend: get('money', 'spend'), save: get('money', 'save'), give: get('money', 'give') },
    };
  });
}

async function settings(familyId: string) {
  const f = await prisma.family.findUniqueOrThrow({ where: { id: familyId }, select: { screenMinutesPerStar: true, centsPerStar: true, currency: true } });
  return { ...f, screenEnabled: f.screenMinutesPerStar !== null, moneyEnabled: f.centsPerStar !== null };
}

// GET /api/bank — rates, balances (kids see their own; parents see everyone) and recent history
router.get('/', async (req: AuthRequest, res) => {
  try {
    const isParent = req.role === 'parent';
    const people = await prisma.member.findMany({
      where: { familyId: req.familyId, ...(isParent ? { role: 'child' } : { id: req.memberId }) },
      select: { id: true, name: true, emoji: true, color: true, stars: true },
      orderBy: { createdAt: 'asc' },
    });
    const ids = people.map(p => p.id);
    const [cfg, bal, history] = await Promise.all([
      settings(req.familyId!),
      balances(req.familyId!, ids),
      prisma.bankEntry.findMany({ where: { familyId: req.familyId, memberId: { in: ids } }, orderBy: { createdAt: 'desc' }, take: 30 }),
    ]);
    res.json({ settings: cfg, members: people.map(p => ({ ...p, ...bal.find(b => b.memberId === p.id) })), history });
  } catch (e) { console.error('bank get', e); res.status(500).json({ error: 'Could not load the bank' }); }
});

// PUT /api/bank/settings — parent sets the rates (null switches a bank off)
router.put('/settings', async (req: AuthRequest, res) => {
  if (!requireParent(req, res)) return;
  const { screenMinutesPerStar, centsPerStar, currency } = req.body || {};
  const rate = (v: any, max: number) => (v === null || v === undefined || v === '' ? null : Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= max ? Number(v) : NaN);
  const screen = rate(screenMinutesPerStar, 120);
  const cents = rate(centsPerStar, 10000);
  if (Number.isNaN(screen)) return res.status(400).json({ error: 'Minutes per star must be a whole number from 1 to 120' });
  if (Number.isNaN(cents)) return res.status(400).json({ error: 'Cents per star must be a whole number from 1 to 10000' });
  if (currency !== undefined && !/^[A-Z]{3}$/.test(String(currency))) return res.status(400).json({ error: 'Currency must be a 3-letter code like CAD' });
  try {
    await prisma.family.update({
      where: { id: req.familyId },
      data: { screenMinutesPerStar: screen, centsPerStar: cents, ...(currency ? { currency: String(currency) } : {}) },
    });
    const cfg = await settings(req.familyId!);
    await audit(req, 'bank.settings', `set the bank: ${cfg.screenEnabled ? `1⭐ = ${cfg.screenMinutesPerStar} min screen time` : 'screen time off'}, ${cfg.moneyEnabled ? `1⭐ = ${money(cfg.centsPerStar!, cfg.currency)}` : 'allowance off'}`, { type: 'family', id: req.familyId });
    res.json(cfg);
  } catch { res.status(500).json({ error: 'Could not save the bank settings' }); }
});

// POST /api/bank/convert — turn stars into screen time or allowance.
// A kid converts their own stars; a parent can do it for a kid (memberId).
router.post('/convert', async (req: AuthRequest, res) => {
  const { kind, stars, bucket, memberId } = req.body || {};
  const who = memberId && req.role === 'parent' ? String(memberId) : req.memberId!;
  if (memberId && memberId !== req.memberId && req.role !== 'parent') return res.status(403).json({ error: 'You can only convert your own stars' });
  if (kind !== 'screen' && kind !== 'money') return res.status(400).json({ error: 'Choose screen time or allowance' });
  const n = Number(stars);
  if (!Number.isInteger(n) || n < 1 || n > 10000) return res.status(400).json({ error: 'Choose how many stars' });
  const b: Bucket | null = kind === 'money' ? (BUCKETS.includes(bucket) ? bucket : 'spend') : null;
  try {
    if (!(await memberInFamily(who, req.familyId!))) return res.status(404).json({ error: 'Member not found' });
    const cfg = await settings(req.familyId!);
    const rate = kind === 'screen' ? cfg.screenMinutesPerStar : cfg.centsPerStar;
    if (rate === null) return res.status(400).json({ error: `${kind === 'screen' ? 'The screen-time bank' : 'The allowance bank'} isn't turned on yet. Ask a parent.` });
    const amount = n * rate;

    const entry = await prisma.$transaction(async tx => {
      // Never spend stars that aren't there, even with quick double taps.
      const spent = await tx.member.updateMany({ where: { id: who, familyId: req.familyId, stars: { gte: n } }, data: { stars: { decrement: n } } });
      if (spent.count !== 1) return null;
      return tx.bankEntry.create({
        data: { familyId: req.familyId!, memberId: who, kind, bucket: b, amount, stars: n, note: `${n}⭐ converted`, createdById: req.memberId },
      });
    });
    if (!entry) {
      const m = await prisma.member.findUnique({ where: { id: who }, select: { stars: true } });
      return res.status(400).json({ error: `Not enough stars (you have ${m?.stars ?? 0})` });
    }
    const kid = await prisma.member.findUnique({ where: { id: who }, select: { name: true } });
    const what = kind === 'screen' ? `${minutes(amount)} of screen time` : `${money(amount, cfg.currency)} (${b})`;
    await audit(req, 'bank.convert', `turned ${n}⭐ into ${what}${who !== req.memberId ? ` for ${kid?.name}` : ''}`, { type: 'bank', id: entry.id });
    if (who === req.memberId) await notifyParents(req.familyId!, '🏦 Stars banked', `${kid?.name} turned ${n}⭐ into ${what}`, req.memberId);
    broadcast(req.familyId!, { type: 'bank:updated', memberId: who });
    const [bal] = await balances(req.familyId!, [who]);
    res.json({ entry, balance: bal });
  } catch (e) { console.error('bank convert', e); res.status(500).json({ error: 'Could not convert stars' }); }
});

// POST /api/bank/use — a parent records screen time used or money paid out
router.post('/use', async (req: AuthRequest, res) => {
  if (!requireParent(req, res)) return;
  const { memberId, kind, amount, bucket, note } = req.body || {};
  if (kind !== 'screen' && kind !== 'money') return res.status(400).json({ error: 'Choose screen time or allowance' });
  const n = Number(amount);
  if (!Number.isInteger(n) || n < 1) return res.status(400).json({ error: kind === 'screen' ? 'Enter minutes' : 'Enter an amount in cents' });
  const b: Bucket | null = kind === 'money' ? (BUCKETS.includes(bucket) ? bucket : 'spend') : null;
  try {
    if (!(await memberInFamily(memberId, req.familyId!))) return res.status(404).json({ error: 'Member not found' });
    const cfg = await settings(req.familyId!);
    // Serialise per member so two parents can't both pay out the same balance.
    const entry = await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'bank:' + memberId}))`;
      const sum = await tx.bankEntry.aggregate({ where: { familyId: req.familyId, memberId, kind, bucket: b }, _sum: { amount: true } });
      if ((sum._sum.amount || 0) < n) return null;
      return tx.bankEntry.create({
        data: { familyId: req.familyId!, memberId, kind, bucket: b, amount: -n, note: note ? String(note).slice(0, 200) : (kind === 'screen' ? 'Screen time used' : 'Paid out'), createdById: req.memberId },
      });
    });
    if (!entry) return res.status(400).json({ error: 'That is more than the balance' });
    const kid = await prisma.member.findUnique({ where: { id: memberId }, select: { name: true } });
    const what = kind === 'screen' ? `${minutes(n)} of screen time` : `${money(n, cfg.currency)} from ${b}`;
    await audit(req, 'bank.use', `${kind === 'screen' ? 'recorded' : 'paid out'} ${what} for ${kid?.name}`, { type: 'bank', id: entry.id });
    await notifyMember(req.familyId!, memberId, kind === 'screen' ? '📺 Screen time used' : '💵 Allowance paid', `${what}${note ? ` — ${note}` : ''}`);
    broadcast(req.familyId!, { type: 'bank:updated', memberId });
    const [bal] = await balances(req.familyId!, [memberId]);
    res.json({ entry, balance: bal });
  } catch (e) { console.error('bank use', e); res.status(500).json({ error: 'Could not record that' }); }
});

// POST /api/bank/move — move allowance between spend / save / give
router.post('/move', async (req: AuthRequest, res) => {
  const { memberId, from, to, amount } = req.body || {};
  const who = memberId && req.role === 'parent' ? String(memberId) : req.memberId!;
  if (memberId && memberId !== req.memberId && req.role !== 'parent') return res.status(403).json({ error: 'You can only move your own money' });
  if (!BUCKETS.includes(from) || !BUCKETS.includes(to) || from === to) return res.status(400).json({ error: 'Choose two different jars' });
  const n = Number(amount);
  if (!Number.isInteger(n) || n < 1) return res.status(400).json({ error: 'Enter an amount in cents' });
  try {
    if (!(await memberInFamily(who, req.familyId!))) return res.status(404).json({ error: 'Member not found' });
    const ok = await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'bank:' + who}))`;
      const sum = await tx.bankEntry.aggregate({ where: { familyId: req.familyId, memberId: who, kind: 'money', bucket: from }, _sum: { amount: true } });
      if ((sum._sum.amount || 0) < n) return false;
      await tx.bankEntry.createMany({
        data: [
          { familyId: req.familyId!, memberId: who, kind: 'money', bucket: from, amount: -n, note: `Moved to ${to}`, createdById: req.memberId },
          { familyId: req.familyId!, memberId: who, kind: 'money', bucket: to, amount: n, note: `Moved from ${from}`, createdById: req.memberId },
        ],
      });
      return true;
    });
    if (!ok) return res.status(400).json({ error: `Not enough in ${from}` });
    broadcast(req.familyId!, { type: 'bank:updated', memberId: who });
    const [bal] = await balances(req.familyId!, [who]);
    res.json({ balance: bal });
  } catch { res.status(500).json({ error: 'Could not move money' }); }
});

export default router;
