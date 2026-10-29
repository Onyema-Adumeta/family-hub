// Step 2 — fair rotation, the fairness meter and recommendations.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { get, post, patch, del, makeFamily, type Family } from './helpers';

const prisma = new PrismaClient();
const assigneesOf = (c: any) => c.assignees.map((a: any) => a.id);
const findChore = async (fam: Family, title: string) => (await get('/api/chores', fam.parent.token)).body.find((c: any) => c.title === title && c.status !== 'done');

test('Take turns: needs two people, starts with the first', async () => {
  const fam = await makeFamily('Rot');
  assert.equal((await post('/api/chores', fam.parent.token, { title: 'x', rotate: true, assigneeIds: [fam.kid1.id] })).status, 400);
  const r = await post('/api/chores', fam.parent.token, { title: 'Dishes', stars: 4, frequency: 'daily', rotate: true, assigneeIds: [fam.kid1.id, fam.kid2.id] });
  assert.equal(r.status, 200);
  assert.deepEqual(assigneesOf(r.body), [fam.kid1.id], 'only the first person is up');
  assert.deepEqual(r.body.rotationIds, [fam.kid1.id, fam.kid2.id]);
  assert.equal(r.body.stars, 4);
});

test('Daily chores that take turns pass to the next person after each completion', async () => {
  const fam = await makeFamily('RotDaily');
  await post('/api/chores', fam.parent.token, { title: 'Dishes', stars: 4, frequency: 'daily', rotate: true, assigneeIds: [fam.kid1.id, fam.kid2.id] });
  let c = await findChore(fam, 'Dishes');
  assert.equal((await patch(`/api/chores/${c.id}`, fam.kid2.token, { status: 'done' })).status, 403, "not Kid Two's turn");
  assert.equal((await patch(`/api/chores/${c.id}`, fam.kid1.token, { status: 'done' })).status, 200);

  c = await findChore(fam, 'Dishes');
  assert.deepEqual(assigneesOf(c), [fam.kid2.id], "tomorrow is Kid Two's turn");
  assert.equal(c.rotate, true);
  assert.equal((await patch(`/api/chores/${c.id}`, fam.kid2.token, { status: 'done' })).status, 200);

  c = await findChore(fam, 'Dishes');
  assert.deepEqual(assigneesOf(c), [fam.kid1.id], 'and back to Kid One');
  const stars = await prisma.member.findMany({ where: { id: { in: [fam.kid1.id, fam.kid2.id] } }, select: { stars: true } });
  assert.deepEqual(stars.map(s => s.stars), [4, 4], 'each got the full stars on their turn');
});

test('Parents can skip to the next turn; kids and other families cannot', async () => {
  const fam = await makeFamily('RotSkip');
  const r = await post('/api/chores', fam.parent.token, { title: 'Bins', stars: 3, frequency: 'weekly', rotate: true, assigneeIds: [fam.kid1.id, fam.kid2.id] });
  assert.equal((await post(`/api/chores/${r.body.id}/rotate`, fam.kid1.token)).status, 403);
  const other = await makeFamily('RotSkipOther');
  assert.equal((await post(`/api/chores/${r.body.id}/rotate`, other.parent.token)).status, 404);
  const next = await post(`/api/chores/${r.body.id}/rotate`, fam.parent.token);
  assert.equal(next.status, 200);
  assert.deepEqual(assigneesOf(next.body), [fam.kid2.id]);
  const plain = await post('/api/chores', fam.parent.token, { title: 'Plain', assigneeIds: [fam.kid1.id] });
  assert.equal((await post(`/api/chores/${plain.body.id}/rotate`, fam.parent.token)).status, 400);
});

test('Turning rotation on and off by editing; removed members are skipped', async () => {
  const fam = await makeFamily('RotEdit');
  const kid3 = await post('/api/auth/join', undefined, { inviteCode: fam.code, name: 'Kid Three', password: '1234' });
  const c = await post('/api/chores', fam.parent.token, { title: 'Walk dog', stars: 2, frequency: 'daily', assigneeIds: [fam.kid1.id] });
  const on = await patch(`/api/chores/${c.body.id}`, fam.parent.token, { rotate: true, assigneeIds: [fam.kid1.id, kid3.body.member.id, fam.kid2.id] });
  assert.equal(on.status, 200);
  assert.deepEqual(on.body.rotationIds, [fam.kid1.id, kid3.body.member.id, fam.kid2.id]);

  await del(`/api/members/${kid3.body.member.id}`, fam.parent.token);
  await patch(`/api/chores/${c.body.id}`, fam.kid1.token, { status: 'done' });
  const next = await findChore(fam, 'Walk dog');
  assert.deepEqual(assigneesOf(next), [fam.kid2.id], 'removed member skipped');
  assert.ok(!next.rotationIds.includes(kid3.body.member.id));

  const off = await patch(`/api/chores/${next.id}`, fam.parent.token, { rotate: false });
  assert.equal(off.body.rotate, false);
  assert.deepEqual(off.body.rotationIds, []);
  assert.equal((await patch(`/api/chores/${next.id}`, fam.kid1.token, { rotate: true })).status, 403, 'kids cannot change rotation');
});

test('Fairness meter: spots one kid doing the work, suggests taking turns', async () => {
  const fam = await makeFamily('Fair');
  for (let i = 0; i < 3; i++) {
    const c = await post('/api/chores', fam.parent.token, { title: `k1-${i}`, stars: 10, frequency: 'weekly', assigneeIds: [fam.kid1.id] });
    await patch(`/api/chores/${c.body.id}`, fam.kid1.token, { status: 'done' });
  }
  await post('/api/chores', fam.parent.token, { title: 'Always Kid One', stars: 5, frequency: 'weekly', assigneeIds: [fam.kid1.id] });
  const f = await get('/api/insights/fairness', fam.parent.token);
  assert.equal(f.status, 200);
  assert.equal(f.body.applicable, true);
  assert.equal(f.body.status, 'unfair');
  assert.equal(f.body.heaviest.id, fam.kid1.id);
  assert.equal(f.body.kids.find((k: any) => k.id === fam.kid1.id).sharePct, 100);
  assert.ok(f.body.score <= 10);
  assert.ok(f.body.suggestions.some((s: any) => s.title === 'Always Kid One'));

  for (let i = 0; i < 3; i++) {
    const c = await post('/api/chores', fam.parent.token, { title: `k2-${i}`, stars: 10, frequency: 'weekly', assigneeIds: [fam.kid2.id] });
    await patch(`/api/chores/${c.body.id}`, fam.kid2.token, { status: 'done' });
  }
  await post('/api/chores', fam.parent.token, { title: 'Always Kid Two', stars: 5, frequency: 'weekly', assigneeIds: [fam.kid2.id] });
  const g = await get('/api/insights/fairness', fam.parent.token);
  assert.equal(g.body.status, 'balanced');
  assert.equal(g.body.score, 100);

  const solo = await prisma.member.update({ where: { id: fam.kid2.id }, data: { role: 'parent' } });
  assert.ok(solo);
  assert.equal((await get('/api/insights/fairness', fam.parent.token)).body.applicable, false, 'needs two kids');
});

test('Recommendations: parents only, ranked, built from this family', async () => {
  const fam = await makeFamily('Recs');
  assert.equal((await get('/api/insights/recommendations', fam.kid1.token)).status, 403);

  // A photo waiting, a chore 5 days overdue, all work on one kid, no meals, no goal.
  const proof = await post('/api/chores', fam.parent.token, { title: 'Room', stars: 5, proofRequired: true, frequency: 'weekly', assigneeIds: [fam.kid1.id] });
  await patch(`/api/chores/${proof.body.id}`, fam.kid1.token, { status: 'done', proofUrl: 'https://example.com/p.jpg' });
  const old = new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  await post('/api/chores', fam.parent.token, { title: 'Garage', stars: 1, frequency: 'weekly', dueDate: old, assigneeIds: [fam.kid1.id] });
  for (let i = 0; i < 2; i++) {
    const c = await post('/api/chores', fam.parent.token, { title: `w${i}`, stars: 10, frequency: 'weekly', assigneeIds: [fam.kid1.id] });
    await patch(`/api/chores/${c.body.id}`, fam.kid1.token, { status: 'done' });
  }

  const r = await get('/api/insights/recommendations', fam.parent.token);
  assert.equal(r.status, 200);
  assert.ok(r.body.length <= 5);
  const kinds = r.body.map((x: any) => x.kind);
  assert.equal(kinds[0], 'approvals', 'most urgent first');
  assert.ok(kinds.includes('slipping'));
  assert.ok(r.body.some((x: any) => x.kind === 'slipping' && /Garage/.test(x.title)));
  assert.ok(kinds.includes('fairness'));
  assert.ok(kinds.includes('meals'));
  const priorities = r.body.map((x: any) => x.priority);
  assert.deepEqual(priorities, [...priorities].sort((a: number, b: number) => b - a));

  const other = await makeFamily('RecsOther');
  const o = await get('/api/insights/recommendations', other.parent.token);
  assert.ok(!JSON.stringify(o.body).includes('Garage'), 'nothing from another family');
});

test.after(() => prisma.$disconnect());
