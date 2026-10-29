// D03 and friends: stars must be awarded exactly once and spent exactly once.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { post, patch, makeFamily, starsOf, type Family } from './helpers';

const prisma = new PrismaClient();

let F: Family;
before(async () => { F = await makeFamily('Stars'); });

test('D03: done -> pending -> done does not award stars twice', async () => {
  const start = await starsOf(F, F.kid1.id);
  const c = await post('/api/chores', F.parent.token, { title: 'Bins', stars: 10, frequency: 'weekly', assigneeIds: [F.kid1.id] });

  assert.equal((await patch(`/api/chores/${c.body.id}`, F.kid1.token, { status: 'done' })).status, 200);
  assert.equal(await starsOf(F, F.kid1.id), start + 10);

  // A kid cannot undo a completion to farm stars.
  const kidUndo = await patch(`/api/chores/${c.body.id}`, F.kid1.token, { status: 'pending' });
  assert.equal(kidUndo.status, 403);
  assert.equal(await starsOf(F, F.kid1.id), start + 10);

  // A parent can undo; the stars come back off.
  assert.equal((await patch(`/api/chores/${c.body.id}`, F.parent.token, { status: 'pending' })).status, 200);
  assert.equal(await starsOf(F, F.kid1.id), start);

  // Completing again awards once — net result is +10, not +20.
  assert.equal((await patch(`/api/chores/${c.body.id}`, F.kid1.token, { status: 'done' })).status, 200);
  assert.equal(await starsOf(F, F.kid1.id), start + 10);
});

test('Completing the same chore twice at the same moment awards once', async () => {
  const start = await starsOf(F, F.kid2.id);
  const c = await post('/api/chores', F.parent.token, { title: 'Race', stars: 8, frequency: 'weekly', assigneeIds: [F.kid2.id] });
  const results = await Promise.all(Array.from({ length: 5 }, () => patch(`/api/chores/${c.body.id}`, F.kid2.token, { status: 'done' })));
  // Late arrivals either get "already done" (409) or a harmless no-op (200); none may pay out again.
  for (const r of results) assert.ok([200, 409].includes(r.status), `unexpected ${r.status}`);
  assert.equal(await starsOf(F, F.kid2.id), start + 8, 'stars awarded exactly once');
  const ledger = await prisma.choreCompletion.count({ where: { choreId: c.body.id } });
  assert.equal(ledger, 1, 'exactly one completion recorded');
});

test('Daily chores award once and come back for tomorrow', async () => {
  const start = await starsOf(F, F.kid1.id);
  const c = await post('/api/chores', F.parent.token, { title: 'Bed', stars: 4, frequency: 'daily', assigneeIds: [F.kid1.id] });
  const done = await patch(`/api/chores/${c.body.id}`, F.kid1.token, { status: 'done' });
  assert.equal(done.status, 200);
  assert.equal(await starsOf(F, F.kid1.id), start + 4);
  const again = await patch(`/api/chores/${c.body.id}`, F.kid1.token, { status: 'done' });
  assert.equal(again.status, 404, 'the completed daily copy is recycled');
  assert.equal(await starsOf(F, F.kid1.id), start + 4);
});

test('Shared chores split stars and still award once', async () => {
  const s1 = await starsOf(F, F.kid1.id);
  const s2 = await starsOf(F, F.kid2.id);
  const c = await post('/api/chores', F.parent.token, { title: 'Garage', stars: 9, frequency: 'weekly', assigneeIds: [F.kid1.id, F.kid2.id] });
  await patch(`/api/chores/${c.body.id}`, F.kid1.token, { status: 'done' });
  const g1 = (await starsOf(F, F.kid1.id)) - s1;
  const g2 = (await starsOf(F, F.kid2.id)) - s2;
  assert.equal(g1 + g2, 9);
  assert.equal(g1, 5, 'completer gets the remainder');
  await patch(`/api/chores/${c.body.id}`, F.parent.token, { status: 'pending' });
  assert.equal(await starsOf(F, F.kid1.id), s1);
  assert.equal(await starsOf(F, F.kid2.id), s2);
});

test('Redeeming cannot overspend, even with rapid taps', async () => {
  const fam = await makeFamily('Spend');
  const c = await post('/api/chores', fam.parent.token, { title: 'earn', stars: 10, frequency: 'once', assigneeIds: [fam.kid1.id] });
  await patch(`/api/chores/${c.body.id}`, fam.kid1.token, { status: 'done' });
  const r = await post('/api/rewards', fam.parent.token, { name: 'Game time', cost: 6 });

  const tries = await Promise.all(Array.from({ length: 4 }, () => post(`/api/rewards/redeem/${r.body.id}`, fam.kid1.token)));
  assert.equal(tries.filter(t => t.status === 200).length, 1, 'only one redemption fits in 10 stars');
  assert.equal(await starsOf(fam, fam.kid1.id), 4);
});

test('A declined request refunds once and cannot be decided twice', async () => {
  const fam = await makeFamily('Refund');
  const c = await post('/api/chores', fam.parent.token, { title: 'earn', stars: 5, frequency: 'once', assigneeIds: [fam.kid1.id] });
  await patch(`/api/chores/${c.body.id}`, fam.kid1.token, { status: 'done' });
  const r = await post('/api/rewards', fam.parent.token, { name: 'Treat', cost: 5 });
  const red = await post(`/api/rewards/redeem/${r.body.id}`, fam.kid1.token);
  assert.equal(await starsOf(fam, fam.kid1.id), 0);

  const decline = await patch(`/api/rewards/redemptions/${red.body.id}`, fam.parent.token, { approved: false });
  assert.equal(decline.status, 200);
  assert.equal(await starsOf(fam, fam.kid1.id), 5);
  const again = await patch(`/api/rewards/redemptions/${red.body.id}`, fam.parent.token, { approved: false });
  assert.ok([404, 409].includes(again.status));
  assert.equal(await starsOf(fam, fam.kid1.id), 5, 'no second refund');

  const red2 = await post(`/api/rewards/redeem/${r.body.id}`, fam.kid1.token);
  assert.equal((await patch(`/api/rewards/redemptions/${red2.body.id}`, fam.parent.token, { approved: true })).status, 200);
  const flip = await patch(`/api/rewards/redemptions/${red2.body.id}`, fam.parent.token, { approved: false });
  assert.equal(flip.status, 409, 'an approved request cannot then be declined for a refund');
  assert.equal(await starsOf(fam, fam.kid1.id), 0);
});

test('A quest pays out once, even if completed twice at once', async () => {
  const before = await starsOf(F, F.kid1.id);
  const q = await post('/api/quests', F.parent.token, { title: 'Clean room', stars: 6, memberId: F.kid1.id });
  const results = await Promise.all(Array.from({ length: 4 }, () => post(`/api/quests/${q.body.id}/complete`, F.kid1.token)));
  assert.equal(results.filter(r => r.status === 200).length, 1);
  assert.equal(await starsOf(F, F.kid1.id), before + 6);
});

test.after(() => prisma.$disconnect());
