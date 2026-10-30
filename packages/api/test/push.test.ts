// Push notifications to phones (via a fake Expo push service in test/run.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { post, patch, call, makeFamily, uniq } from './helpers';

const FAKE = process.env.FAKE_AI_URL || 'http://127.0.0.1:3998';
const token = (label = 'Phone') => `ExponentPushToken[${uniq(label)}xxxxxxxx]`;

async function pushesTo(t: string): Promise<any[]> {
  const all: any[] = await (await fetch(FAKE + '/__pushes')).json();
  return all.filter(p => p.to === t);
}
/** Waits up to ~3 s for at least `n` pushes to arrive for a token. */
async function waitFor(t: string, n: number) {
  for (let i = 0; i < 30; i++) {
    const got = await pushesTo(t);
    if (got.length >= n) return got;
    await new Promise(r => setTimeout(r, 100));
  }
  return pushesTo(t);
}
const register = (auth: string, t: string) => post('/api/notifications/register-push', auth, { token: t, platform: 'android' });

async function proofChore(fam: Awaited<ReturnType<typeof makeFamily>>) {
  const c = await post('/api/chores', fam.parent.token, { title: uniq('Bed'), assigneeIds: [fam.kid1.id], proofRequired: true, stars: 5 });
  assert.equal(c.status, 200);
  return c.body;
}

test('only real Expo push tokens are accepted', async () => {
  const fam = await makeFamily('PushBad');
  assert.equal((await register(fam.kid1.token, 'not-a-token')).status, 400);
  assert.equal((await register(fam.kid1.token, 'https://evil.example/hook')).status, 400);
  assert.equal((await register(fam.kid1.token, token())).status, 200);
});

test('a photo to check reaches the parent’s phone, and the approval reaches the kid’s', async () => {
  const fam = await makeFamily('PushFlow');
  const parentPhone = token('Parent'), kidPhone = token('Kid');
  await register(fam.parent.token, parentPhone);
  await register(fam.kid1.token, kidPhone);
  const chore = await proofChore(fam);

  const sent = await patch(`/api/chores/${chore.id}`, fam.kid1.token, { status: 'done', proofUrl: 'https://res.cloudinary.com/x/proof.jpg', proofType: 'image' });
  assert.equal(sent.body.status, 'review');
  const toParent = await waitFor(parentPhone, 1);
  assert.match(toParent.at(-1).title, /to check/);
  assert.equal(toParent.at(-1).data.url, '/chores');

  assert.equal((await post(`/api/chores/${chore.id}/approve`, fam.parent.token)).status, 200);
  const toKid = await waitFor(kidPhone, 2); // "New chore assigned" earlier, then "Approved!"
  assert.ok(toKid.some(p => /Approved/.test(p.title)), JSON.stringify(toKid.map(p => p.title)));
});

test('a phone belongs to whoever signed in on it last', async () => {
  const fam = await makeFamily('PushMove');
  const shared = token('Shared');
  await register(fam.kid1.token, shared);
  await register(fam.kid2.token, shared);
  const before = (await pushesTo(shared)).length;
  await post('/api/chores', fam.parent.token, { title: uniq('ForKid1'), assigneeIds: [fam.kid1.id] });
  await post('/api/chores', fam.parent.token, { title: uniq('ForKid2'), assigneeIds: [fam.kid2.id] });
  const got = await waitFor(shared, before + 1);
  const after = got.slice(before);
  assert.equal(after.length, 1, JSON.stringify(after.map(p => p.body)));
  assert.match(after[0].body, /ForKid2/);
});

test('switching off chat on a phone stops chat pushes there, but not other kinds', async () => {
  const fam = await makeFamily('PushPrefs');
  const kidPhone = token('Prefs');
  await register(fam.kid1.token, kidPhone);
  assert.equal((await patch('/api/notifications/push-preferences', fam.kid1.token, { token: kidPhone, tasks: true, rewards: true, chat: false })).status, 200);
  const before = (await pushesTo(kidPhone)).length;
  await post('/api/chat', fam.parent.token, { text: 'Dinner!' });
  await post('/api/chores', fam.parent.token, { title: uniq('Tidy'), assigneeIds: [fam.kid1.id] });
  const after = (await waitFor(kidPhone, before + 1)).slice(before);
  await new Promise(r => setTimeout(r, 300)); // give a chat push time to (wrongly) arrive
  const final = (await pushesTo(kidPhone)).slice(before);
  assert.ok(final.every(p => !/chat/i.test(p.title)), JSON.stringify(final.map(p => p.title)));
  assert.ok(after.some(p => /chore/i.test(p.title)));
  // Someone else's phone can't be changed.
  const other = await makeFamily('PushPrefsOther');
  assert.equal((await patch('/api/notifications/push-preferences', other.parent.token, { token: kidPhone, tasks: false, rewards: false, chat: false })).status, 404);
});

test('an uninstalled app’s token is forgotten after the first failed push', async () => {
  const fam = await makeFamily('PushGone');
  const gone = token('Gone');
  await register(fam.kid1.token, gone);
  await post('/api/chores', fam.parent.token, { title: uniq('One'), assigneeIds: [fam.kid1.id] });
  await waitFor(gone, 1);
  await post('/api/chores', fam.parent.token, { title: uniq('Two'), assigneeIds: [fam.kid1.id] });
  await new Promise(r => setTimeout(r, 300));
  assert.equal((await pushesTo(gone)).length, 1);
});

test('signing someone out everywhere stops pushes to their phones; signing out on the phone too', async () => {
  const fam = await makeFamily('PushOut');
  const lost = token('Lost'), mine = token('Mine');
  await register(fam.kid1.token, lost);
  assert.equal((await post(`/api/members/${fam.kid1.id}/sign-out`, fam.parent.token)).status, 200);
  await register(fam.kid2.token, mine);
  assert.equal((await call('DELETE', '/api/notifications/register-push', fam.kid2.token, { token: mine })).status, 200);
  await post('/api/chores', fam.parent.token, { title: uniq('After'), assigneeIds: [fam.kid1.id, fam.kid2.id] });
  await new Promise(r => setTimeout(r, 400));
  assert.equal((await pushesTo(lost)).length, 0);
  assert.equal((await pushesTo(mine)).length, 0);
});

test('a test push reports that it reached the phone', async () => {
  const fam = await makeFamily('PushTest');
  await register(fam.parent.token, token('T'));
  const r = await post('/api/notifications/push-test', fam.parent.token);
  assert.equal(r.status, 200);
  assert.equal(r.body.phones, 1);
});
