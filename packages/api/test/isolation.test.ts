// D02: one family must never be able to read, change or delete another family's data.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { get, post, patch, del, makeFamily, type Family } from './helpers';

let A: Family;
let B: Family;

before(async () => {
  A = await makeFamily('IsoA');
  B = await makeFamily('IsoB');
});

const NOT_ALLOWED = [403, 404];
function blocked(status: number, what: string) {
  assert.ok(NOT_ALLOWED.includes(status), `${what}: expected 403/404, got ${status}`);
}

test('chores: other family cannot edit, complete, photo or delete', async () => {
  const c = await post('/api/chores', A.parent.token, { title: 'A chore', stars: 5, frequency: 'weekly', assigneeIds: [A.kid1.id] });
  assert.equal(c.status, 200);
  blocked((await patch(`/api/chores/${c.body.id}`, B.parent.token, { title: 'pwned' })).status, 'B parent edits A chore');
  blocked((await patch(`/api/chores/${c.body.id}`, B.kid1.token, { status: 'done' })).status, 'B kid completes A chore');
  blocked((await del(`/api/chores/${c.body.id}`, B.parent.token)).status, 'B parent deletes A chore');
  const list = await get('/api/chores', A.parent.token);
  const still = list.body.find((x: any) => x.id === c.body.id);
  assert.ok(still, 'chore still exists');
  assert.equal(still.title, 'A chore');
});

test('chores: cannot assign another family\'s member', async () => {
  const r = await post('/api/chores', A.parent.token, { title: 'x', assigneeIds: [B.kid1.id] });
  assert.equal(r.status, 400);
});

test('quests: other family cannot complete, edit or delete', async () => {
  const q = await post('/api/quests', A.parent.token, { title: 'A quest', stars: 10, memberId: A.kid1.id });
  assert.equal(q.status, 200);
  blocked((await post(`/api/quests/${q.body.id}/complete`, B.parent.token)).status, 'B completes A quest');
  blocked((await patch(`/api/quests/${q.body.id}`, B.parent.token, { title: 'x' })).status, 'B edits A quest');
  blocked((await patch(`/api/quests/${q.body.id}/stages`, B.parent.token, { stages: [] })).status, 'B edits A stages');
  blocked((await del(`/api/quests/${q.body.id}`, B.parent.token)).status, 'B deletes A quest');
});

test('wishlist: other family cannot read, add, claim, review or delete', async () => {
  const w = await post(`/api/wishlist/${A.kid1.id}`, A.kid1.token, { title: 'Bike' });
  assert.equal(w.status, 200);
  blocked((await get(`/api/wishlist/${A.kid1.id}`, B.parent.token)).status, 'B reads A wishlist');
  blocked((await post(`/api/wishlist/${A.kid1.id}`, B.parent.token, { title: 'spam' })).status, 'B adds to A wishlist');
  blocked((await patch(`/api/wishlist/${w.body.id}/claim`, B.parent.token)).status, 'B claims A wish');
  blocked((await patch(`/api/wishlist/${w.body.id}/approve`, B.parent.token)).status, 'B approves A wish');
  blocked((await del(`/api/wishlist/${w.body.id}`, B.parent.token)).status, 'B deletes A wish');
});

test('meals: other family cannot edit or delete; familyId in the body is ignored', async () => {
  const m = await post('/api/meals', A.parent.token, { name: 'Tacos', day: 'Mon', week: '2026-W44', familyId: B.id });
  assert.equal(m.status, 200);
  assert.equal(m.body.familyId, A.id, 'meal lands in the caller\'s family, not the one in the body');
  blocked((await patch(`/api/meals/${m.body.id}`, B.parent.token, { name: 'x' })).status, 'B edits A meal');
  blocked((await del(`/api/meals/${m.body.id}`, B.parent.token)).status, 'B deletes A meal');
  const moved = await patch(`/api/meals/${m.body.id}`, A.parent.token, { familyId: B.id });
  assert.equal(moved.status, 200);
  assert.equal(moved.body.familyId, A.id, 'cannot move a meal to another family');
});

test('events: other family cannot delete; familyId in the body is ignored', async () => {
  const e = await post('/api/events', A.parent.token, { title: 'Dentist', date: '2026-11-03', familyId: B.id });
  assert.equal(e.status, 200);
  assert.equal(e.body.familyId, A.id);
  blocked((await del(`/api/events/${e.body.id}`, B.parent.token)).status, 'B deletes A event');
  const list = await get('/api/events', B.parent.token);
  assert.ok(!list.body.some((x: any) => x.id === e.body.id), 'B cannot see A events');
});

test('grocery: other family cannot edit or delete', async () => {
  const g = await post('/api/grocery', A.parent.token, { name: 'Milk' });
  assert.equal(g.status, 200);
  blocked((await patch(`/api/grocery/${g.body.id}`, B.parent.token, { name: 'x' })).status, 'B edits A grocery');
  blocked((await del(`/api/grocery/${g.body.id}`, B.parent.token)).status, 'B deletes A grocery');
  const self = await patch(`/api/grocery/${g.body.id}`, A.kid1.token, { checked: true, familyId: B.id });
  assert.equal(self.status, 200);
  assert.equal(self.body.familyId, A.id);
});

test('rewards and redemptions: other family cannot delete, redeem or approve', async () => {
  const r = await post('/api/rewards', A.parent.token, { name: 'Movie night', cost: 1 });
  assert.equal(r.status, 200);
  blocked((await del(`/api/rewards/${r.body.id}`, B.parent.token)).status, 'B deletes A reward');
  blocked((await post(`/api/rewards/redeem/${r.body.id}`, B.kid1.token)).status, 'B kid redeems A reward');

  // Give A's kid a star via a chore, then redeem and try to approve from B.
  const c = await post('/api/chores', A.parent.token, { title: 'star', stars: 1, frequency: 'once', assigneeIds: [A.kid1.id] });
  await patch(`/api/chores/${c.body.id}`, A.kid1.token, { status: 'done' });
  const red = await post(`/api/rewards/redeem/${r.body.id}`, A.kid1.token);
  assert.equal(red.status, 200);
  blocked((await patch(`/api/rewards/redemptions/${red.body.id}`, B.parent.token, { approved: true })).status, 'B approves A redemption');
  const bList = await get('/api/rewards/redemptions', B.parent.token);
  assert.ok(!bList.body.some((x: any) => x.id === red.body.id), 'B cannot see A redemptions');
});

test('rules: other family cannot edit or delete; cannot target another family', async () => {
  const bad = await post('/api/rules', A.parent.token, { assignedToId: B.kid1.id, minStars: 5 });
  assert.equal(bad.status, 400);
  const rule = await post('/api/rules', A.parent.token, { assignedToId: A.kid1.id, minStars: 5 });
  assert.equal(rule.status, 200);
  blocked((await patch(`/api/rules/${rule.body.id}`, B.parent.token, { active: false })).status, 'B edits A rule');
  blocked((await del(`/api/rules/${rule.body.id}`, B.parent.token)).status, 'B deletes A rule');
});

test('trips: other family cannot see or change; cannot add another family\'s member', async () => {
  const t = await post('/api/trips', A.parent.token, { title: 'Lake', startDate: '2026-12-01', endDate: '2026-12-03' });
  assert.equal(t.status, 200);
  blocked((await get(`/api/trips/${t.body.id}`, B.parent.token)).status, 'B reads A trip');
  blocked((await patch(`/api/trips/${t.body.id}`, B.parent.token, { title: 'x' })).status, 'B edits A trip');
  blocked((await del(`/api/trips/${t.body.id}`, B.parent.token)).status, 'B deletes A trip');
  const pack = await post(`/api/trips/${t.body.id}/packing`, A.parent.token, { name: 'Socks', memberId: B.kid1.id });
  assert.equal(pack.status, 400);
});

test('notifications: cannot mark another family\'s notifications or message their members', async () => {
  await post('/api/notifications/broadcast', A.parent.token, { title: 'Hi', body: 'Dinner at 6' });
  const mine = await get('/api/notifications', A.kid1.token);
  assert.ok(mine.body.length > 0);
  blocked((await patch(`/api/notifications/${mine.body[0].id}/read`, B.parent.token)).status, 'B marks A notification');
  blocked((await post('/api/notifications/send', B.parent.token, { memberId: A.kid1.id, title: 'x', body: 'y' })).status, 'B messages A kid');
});

test('members: other family cannot edit, promote or remove', async () => {
  blocked((await patch(`/api/members/${A.kid1.id}`, B.parent.token, { name: 'pwned' })).status, 'B renames A kid');
  blocked((await patch(`/api/members/${A.kid1.id}/role`, B.parent.token, { role: 'parent' })).status, 'B promotes A kid');
  blocked((await del(`/api/members/${A.kid1.id}`, B.parent.token)).status, 'B removes A kid');
});
