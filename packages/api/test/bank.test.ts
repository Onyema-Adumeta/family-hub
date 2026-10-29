// Step 3 — stars to real value: screen-time and allowance bank (a ledger).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { get, post, put, makeFamily, starsOf, type Family } from './helpers';

const prisma = new PrismaClient();
const give = (fam: Family, id: string, n: number) => prisma.member.update({ where: { id }, data: { stars: n } });
const balanceOf = async (fam: Family, id: string) => (await get('/api/bank', fam.parent.token)).body.members.find((m: any) => m.id === id);
async function bankFamily(label: string) {
  const fam = await makeFamily(label);
  await put('/api/bank/settings', fam.parent.token, { screenMinutesPerStar: 5, centsPerStar: 10 });
  return fam;
}

test('Bank is off until a parent sets rates; only parents can set them', async () => {
  const fam = await makeFamily('BankOff');
  await give(fam, fam.kid1.id, 10);
  const off = await post('/api/bank/convert', fam.kid1.token, { kind: 'screen', stars: 2 });
  assert.equal(off.status, 400);
  assert.match(off.body.error, /isn't turned on/);
  assert.equal((await put('/api/bank/settings', fam.kid1.token, { screenMinutesPerStar: 60 })).status, 403);
  assert.equal((await put('/api/bank/settings', fam.parent.token, { screenMinutesPerStar: 0 })).status, 400);
  assert.equal((await put('/api/bank/settings', fam.parent.token, { centsPerStar: 1.5 })).status, 400);
  const ok = await put('/api/bank/settings', fam.parent.token, { screenMinutesPerStar: 5, centsPerStar: null });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.screenEnabled, true);
  assert.equal(ok.body.moneyEnabled, false);
});

test('Kids turn their own stars into screen time and allowance jars', async () => {
  const fam = await bankFamily('BankKid');
  await give(fam, fam.kid1.id, 20);
  const s = await post('/api/bank/convert', fam.kid1.token, { kind: 'screen', stars: 4 });
  assert.equal(s.status, 200);
  assert.equal(s.body.balance.screenMinutes, 20);
  const m = await post('/api/bank/convert', fam.kid1.token, { kind: 'money', stars: 6, bucket: 'save' });
  assert.equal(m.body.balance.money.save, 60);
  assert.equal(await starsOf(fam, fam.kid1.id), 10, 'stars spent');
  const life = await prisma.member.findUniqueOrThrow({ where: { id: fam.kid1.id } });
  assert.equal(life.lifetimeStars, 0, 'banking does not change levels (lifetime untouched)');

  assert.equal((await post('/api/bank/convert', fam.kid1.token, { kind: 'screen', stars: 50 })).status, 400, 'not enough stars');
  assert.equal((await post('/api/bank/convert', fam.kid1.token, { kind: 'screen', stars: 1, memberId: fam.kid2.id })).status, 403, "not a sibling's stars");

  const mine = await get('/api/bank', fam.kid1.token);
  assert.equal(mine.body.members.length, 1, 'kids see only their own bank');
  assert.equal(mine.body.members[0].screenMinutes, 20);
  const parentView = await get('/api/bank', fam.parent.token);
  assert.equal(parentView.body.members.length, 2, 'parents see every kid');
  const notes = await get('/api/notifications', fam.parent.token);
  assert.ok(notes.body.some((n: any) => /Stars banked/.test(n.title)));
});

test('Rapid taps cannot spend the same stars twice', async () => {
  const fam = await bankFamily('BankRace');
  await give(fam, fam.kid1.id, 10);
  const tries = await Promise.all(Array.from({ length: 4 }, () => post('/api/bank/convert', fam.kid1.token, { kind: 'screen', stars: 6 })));
  assert.equal(tries.filter(t => t.status === 200).length, 1);
  assert.equal(await starsOf(fam, fam.kid1.id), 4);
  assert.equal((await balanceOf(fam, fam.kid1.id)).screenMinutes, 30);
});

test('Parents record screen time used and money paid out; no overdrawing', async () => {
  const fam = await bankFamily('BankUse');
  await give(fam, fam.kid1.id, 20);
  await post('/api/bank/convert', fam.parent.token, { kind: 'screen', stars: 4, memberId: fam.kid1.id });
  await post('/api/bank/convert', fam.parent.token, { kind: 'money', stars: 6, bucket: 'spend', memberId: fam.kid1.id });

  assert.equal((await post('/api/bank/use', fam.kid1.token, { memberId: fam.kid1.id, kind: 'screen', amount: 5 })).status, 403, 'kids cannot record use');
  const used = await post('/api/bank/use', fam.parent.token, { memberId: fam.kid1.id, kind: 'screen', amount: 15, note: 'Minecraft' });
  assert.equal(used.status, 200);
  assert.equal(used.body.balance.screenMinutes, 5);
  assert.equal((await post('/api/bank/use', fam.parent.token, { memberId: fam.kid1.id, kind: 'screen', amount: 6 })).status, 400, 'more than the balance');

  const pays = await Promise.all([1, 2].map(() => post('/api/bank/use', fam.parent.token, { memberId: fam.kid1.id, kind: 'money', amount: 40, bucket: 'spend' })));
  assert.equal(pays.filter(p => p.status === 200).length, 1, 'two parents cannot both pay out the same money');
  assert.equal((await balanceOf(fam, fam.kid1.id)).money.spend, 20);
  const kidNotes = await get('/api/notifications', fam.kid1.token);
  assert.ok(kidNotes.body.some((n: any) => /Allowance paid/.test(n.title)));
});

test('Money moves between spend, save and give jars', async () => {
  const fam = await bankFamily('BankJars');
  await give(fam, fam.kid1.id, 10);
  await post('/api/bank/convert', fam.kid1.token, { kind: 'money', stars: 10 });
  const mv = await post('/api/bank/move', fam.kid1.token, { from: 'spend', to: 'give', amount: 30 });
  assert.equal(mv.status, 200);
  assert.deepEqual(mv.body.balance.money, { spend: 70, save: 0, give: 30 });
  assert.equal((await post('/api/bank/move', fam.kid1.token, { from: 'save', to: 'spend', amount: 1 })).status, 400, 'empty jar');
  assert.equal((await post('/api/bank/move', fam.kid1.token, { from: 'spend', to: 'spend', amount: 1 })).status, 400);
  assert.equal((await post('/api/bank/move', fam.kid2.token, { memberId: fam.kid1.id, from: 'spend', to: 'save', amount: 1 })).status, 403);
});

test('Bank is private to each family, logged, and in the data export', async () => {
  const fam = await bankFamily('BankIso');
  await give(fam, fam.kid1.id, 5);
  await post('/api/bank/convert', fam.kid1.token, { kind: 'screen', stars: 5 });
  const other = await bankFamily('BankIsoOther');
  assert.equal((await post('/api/bank/use', other.parent.token, { memberId: fam.kid1.id, kind: 'screen', amount: 1 })).status, 404);
  assert.equal((await post('/api/bank/convert', other.parent.token, { kind: 'screen', stars: 1, memberId: fam.kid1.id })).status, 404);
  assert.ok(!(await get('/api/bank', other.parent.token)).body.members.some((m: any) => m.id === fam.kid1.id));

  const log = await get('/api/family/audit', fam.parent.token);
  assert.ok(log.body.some((e: any) => /turned 5⭐ into 25 min of screen time/.test(e.summary)));
  const exp = await post('/api/family/export', fam.parent.token, { password: fam.parent.password });
  assert.equal(exp.body.bankEntries.length, 1);
});

test.after(() => prisma.$disconnect());
