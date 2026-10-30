// Fixes from the 29 October Muse retest (R1, R2, R3, R8, R11).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BASE, get, post, put, patch, makeFamily, uniq, linkToken } from './helpers';

const STRICT = process.env.STRICT_API_URL || 'http://127.0.0.1:3997';
async function strictPost(path: string, body: unknown) {
  const r = await fetch(STRICT + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => null) };
}
async function strictFamily() {
  const email = `${uniq('strict')}@example.com`;
  const r = await strictPost('/api/auth/register', { familyName: uniq('Strict'), name: 'Parent', password: 'parent-pass-1', email, acceptTerms: true, childDataConsent: true });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const code = r.body.family.inviteCode;
  for (const name of ['Kid A', 'Kid B']) assert.equal((await strictPost('/api/auth/join', { inviteCode: code, name, password: '1234' })).status, 200);
  return code;
}

// ── R1: the fairness meter is for the whole family (decided 30 Oct 2026) ─────
test('R1: kids can see the fairness meter; recommendations stay parent-only', async () => {
  const fam = await makeFamily('Fair');
  assert.equal((await get('/api/insights/fairness', fam.kid1.token)).status, 200);
  assert.equal((await get('/api/insights/recommendations', fam.kid1.token)).status, 403);
});

// ── R2: a household on one network is not locked out by normal use ──────────
test('R2: many correct sign-ins from one network are never blocked (production limits)', async () => {
  const code = await strictFamily();
  for (let i = 0; i < 40; i++) {
    const r = await strictPost('/api/auth/login', { familyCode: code, name: i % 2 ? 'Kid A' : 'Kid B', password: '1234' });
    assert.equal(r.status, 200, `sign-in ${i + 1} was blocked: ${JSON.stringify(r.body)}`);
  }
});

test('R2: guessing one account is stopped, and the message says how long to wait', async () => {
  const code = await strictFamily();
  for (let i = 0; i < 10; i++) {
    assert.equal((await strictPost('/api/auth/login', { familyCode: code, name: 'Kid A', password: 'nope' + i })).status, 401);
  }
  const locked = await strictPost('/api/auth/login', { familyCode: code, name: 'Kid A', password: '1234' });
  assert.equal(locked.status, 429);
  assert.match(locked.body.error, /this account/);
  assert.match(locked.body.error, /wait \d+ minute/);
  // Others on the same network can still sign in.
  assert.equal((await strictPost('/api/auth/login', { familyCode: code, name: 'Kid B', password: '1234' })).status, 200);
});

// ── R8: parent passwords need 8+ characters; kids keep PINs ─────────────────
test('R8: new parent passwords need at least 8 characters', async () => {
  const short = await post('/api/auth/register', undefined, { familyName: uniq('Short'), name: 'P', password: 'abc123', email: `${uniq('s')}@example.com`, acceptTerms: true, childDataConsent: true });
  assert.equal(short.status, 400);
  assert.match(short.body.error, /at least 8/);

  const fam = await makeFamily('Pw');
  const toShort = await put(`/api/members/${fam.parent.id}/password`, fam.parent.token, { currentPassword: fam.parent.password, password: 'abcd123' });
  assert.equal(toShort.status, 400);
  // Kids can still use a 4-digit PIN, including when a parent sets it.
  assert.equal((await put(`/api/members/${fam.kid1.id}/password`, fam.parent.token, { password: '4321' })).status, 200);
});

test('R8: a parent with an old short password can still sign in, and is told to change it', async () => {
  const fam = await makeFamily('Weak');
  // A kid (PIN 1234) promoted to parent has a short password.
  assert.equal((await patch(`/api/members/${fam.kid2.id}/role`, fam.parent.token, { role: 'parent' })).status, 200);
  const r = await post('/api/auth/login', undefined, { familyCode: fam.code, name: fam.kid2.name, password: '1234' });
  assert.equal(r.status, 200);
  assert.equal(r.body.passwordTooShort, true);
  const strong = await post('/api/auth/login', undefined, { familyCode: fam.code, name: 'Parent', password: fam.parent.password });
  assert.equal(strong.body.passwordTooShort, undefined);
});

test('R8: a too-short reset password is refused without using up the link', async () => {
  const fam = await makeFamily('Reset');
  const vtoken = linkToken(fam.email, 'verify-email');
  assert.equal((await post('/api/auth/verify-email', undefined, { token: vtoken })).status, 200);
  await post('/api/auth/forgot-password', undefined, { email: fam.email });
  const token = linkToken(fam.email, 'reset-password');
  assert.ok(token);
  const short = await post('/api/auth/reset-password', undefined, { token, password: 'short1' });
  assert.equal(short.status, 400);
  assert.match(short.body.error, /at least 8/);
  assert.equal((await post('/api/auth/reset-password', undefined, { token, password: 'a-much-longer-one' })).status, 200);
});

// ── R3 and R11: avatar photos and uploads that actually work ────────────────
// A 1×1 PNG.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
async function upload(path: string, token: string, field: string, data: Buffer, type: string, name: string) {
  const form = new FormData();
  form.append(field, new Blob([data], { type }), name);
  const r = await fetch(BASE + path, { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: form });
  return { status: r.status, body: await r.json().catch(() => null) };
}

test('R3: members can set their own photo; parents can set anyone’s in the family', async () => {
  const fam = await makeFamily('Pic');
  const own = await upload(`/api/members/${fam.kid1.id}/avatar`, fam.kid1.token, 'avatar', PNG, 'image/png', 'me.png');
  assert.equal(own.status, 200, JSON.stringify(own.body));
  assert.ok(own.body.avatarUrl);
  const served = await fetch(BASE + own.body.avatarUrl);
  assert.equal(served.status, 200);
  assert.equal(served.headers.get('content-type'), 'image/png');

  assert.equal((await upload(`/api/members/${fam.kid2.id}/avatar`, fam.kid1.token, 'avatar', PNG, 'image/png', 'x.png')).status, 403);
  assert.equal((await upload(`/api/members/${fam.kid2.id}/avatar`, fam.parent.token, 'avatar', PNG, 'image/png', 'x.png')).status, 200);
  const other = await makeFamily('PicOther');
  assert.equal((await upload(`/api/members/${fam.kid1.id}/avatar`, other.parent.token, 'avatar', PNG, 'image/png', 'x.png')).status, 404);
  assert.equal((await upload(`/api/members/${fam.kid1.id}/avatar`, fam.kid1.token, 'avatar', Buffer.from('hello'), 'text/plain', 'x.txt')).status, 400);
});

test('R11: an uploaded chat or proof photo gets a link that works', async () => {
  const fam = await makeFamily('Up');
  const r = await upload('/api/upload', fam.kid1.token, 'file', PNG, 'image/png', 'proof.png');
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.type, 'image');
  assert.equal((await fetch(BASE + r.body.url)).status, 200);
  // File names are random, so links can't be guessed.
  assert.match(r.body.url, /\/uploads\/[0-9a-f]{32}\.png$/);
});
