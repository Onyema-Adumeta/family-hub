// D04, D05, D07: parent-only actions must be enforced by the API, not just hidden in the UI.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { get, post, patch, del, makeFamily, starsOf, type Family } from './helpers';

let F: Family;
before(async () => { F = await makeFamily('Perm'); });

test('D07: kids cannot create, delete or re-price chores', async () => {
  assert.equal((await post('/api/chores', F.kid1.token, { title: 'Free stars', stars: 999 })).status, 403);
  const c = await post('/api/chores', F.parent.token, { title: 'Dishes', stars: 5, frequency: 'weekly', assigneeIds: [F.kid1.id] });
  assert.equal(c.status, 200);
  assert.equal((await patch(`/api/chores/${c.body.id}`, F.kid1.token, { stars: 999 })).status, 403);
  assert.equal((await patch(`/api/chores/${c.body.id}`, F.kid1.token, { title: 'x' })).status, 403);
  assert.equal((await patch(`/api/chores/${c.body.id}`, F.kid1.token, { assigneeIds: [F.kid2.id] })).status, 403);
  assert.equal((await del(`/api/chores/${c.body.id}`, F.kid1.token)).status, 403);
  assert.equal((await post('/api/chores/reset-daily', F.kid1.token)).status, 403);
  const list = await get('/api/chores', F.parent.token);
  assert.equal(list.body.find((x: any) => x.id === c.body.id).stars, 5);
});

test('D07: kids can only complete their own (or unassigned) chores', async () => {
  const theirs = await post('/api/chores', F.parent.token, { title: 'Kid2 chore', stars: 3, frequency: 'weekly', assigneeIds: [F.kid2.id] });
  assert.equal((await patch(`/api/chores/${theirs.body.id}`, F.kid1.token, { status: 'done' })).status, 403);
  assert.equal((await patch(`/api/chores/${theirs.body.id}`, F.kid2.token, { status: 'done' })).status, 200);
  const anyone = await post('/api/chores', F.parent.token, { title: 'Anyone', stars: 2, frequency: 'weekly' });
  assert.equal((await patch(`/api/chores/${anyone.body.id}`, F.kid1.token, { status: 'done' })).status, 200);
});

test('Chore stars must be a sensible whole number', async () => {
  assert.equal((await post('/api/chores', F.parent.token, { title: 'x', stars: -5 })).status, 400);
  assert.equal((await post('/api/chores', F.parent.token, { title: 'x', stars: 100000 })).status, 400);
});

test('D04: kids cannot create or delete rewards, or approve redemptions (including their own)', async () => {
  assert.equal((await post('/api/rewards', F.kid1.token, { name: 'Free stuff', cost: 1 })).status, 403);
  const r = await post('/api/rewards', F.parent.token, { name: 'Sticker', cost: 2 });
  assert.equal((await del(`/api/rewards/${r.body.id}`, F.kid1.token)).status, 403);

  const c = await post('/api/chores', F.parent.token, { title: 'earn', stars: 2, frequency: 'once', assigneeIds: [F.kid1.id] });
  await patch(`/api/chores/${c.body.id}`, F.kid1.token, { status: 'done' });
  const red = await post(`/api/rewards/redeem/${r.body.id}`, F.kid1.token);
  assert.equal(red.status, 200);
  assert.equal((await patch(`/api/rewards/redemptions/${red.body.id}`, F.kid1.token, { approved: true })).status, 403);
  assert.equal((await patch(`/api/rewards/redemptions/${red.body.id}`, F.kid2.token, { approved: true })).status, 403);
  const ok = await patch(`/api/rewards/redemptions/${red.body.id}`, F.parent.token, { approved: true });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.approved, true);
});

test('D05: kids cannot send or broadcast notifications', async () => {
  assert.equal((await post('/api/notifications/broadcast', F.kid1.token, { title: 'x', body: 'y' })).status, 403);
  assert.equal((await post('/api/notifications/send', F.kid1.token, { memberId: F.kid2.id, title: 'x', body: 'y' })).status, 403);
  assert.equal((await post('/api/notifications/broadcast', F.parent.token, { title: 'Dinner', body: 'At 6' })).status, 200);
});

test('Quests: kids cannot create, edit or delete; can complete only their own', async () => {
  assert.equal((await post('/api/quests', F.kid1.token, { title: 'x', stars: 500 })).status, 403);
  const q = await post('/api/quests', F.parent.token, { title: 'Read a book', stars: 7, memberId: F.kid2.id });
  assert.equal((await patch(`/api/quests/${q.body.id}`, F.kid1.token, { stars: 500 })).status, 403);
  assert.equal((await del(`/api/quests/${q.body.id}`, F.kid1.token)).status, 403);
  assert.equal((await post(`/api/quests/${q.body.id}/complete`, F.kid1.token)).status, 403);
  const before = await starsOf(F, F.kid2.id);
  assert.equal((await post(`/api/quests/${q.body.id}/complete`, F.kid2.token)).status, 200);
  assert.equal(await starsOf(F, F.kid2.id), before + 7);
});

test('Wishlist: kids add only to their own list; parents review', async () => {
  assert.equal((await post(`/api/wishlist/${F.kid2.id}`, F.kid1.token, { title: 'x' })).status, 403);
  const w = await post(`/api/wishlist/${F.kid1.id}`, F.kid1.token, { title: 'Lego' });
  assert.equal(w.status, 200);
  assert.equal((await patch(`/api/wishlist/${w.body.id}/approve`, F.kid1.token)).status, 403);
  assert.equal((await del(`/api/wishlist/${w.body.id}`, F.kid2.token)).status, 403);
  assert.equal((await patch(`/api/wishlist/${w.body.id}/approve`, F.parent.token)).status, 200);
});

test('Members: kids can edit only themselves and cannot set roles', async () => {
  assert.equal((await patch(`/api/members/${F.kid2.id}`, F.kid1.token, { name: 'x' })).status, 403);
  assert.equal((await patch(`/api/members/${F.kid1.id}`, F.kid1.token, { emoji: '🐸' })).status, 200);
  assert.equal((await patch(`/api/members/${F.kid1.id}/role`, F.kid1.token, { role: 'parent' })).status, 403);
  assert.equal((await del(`/api/members/${F.kid2.id}`, F.kid1.token)).status, 403);
});
