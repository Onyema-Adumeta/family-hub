// "Let them choose a new PIN": a parent resets a kid's PIN without picking one for them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { post, makeFamily, uniq } from './helpers';

const login = (code: string, name: string, password: string) => post('/api/auth/login', undefined, { familyCode: code, name, password });

test('after a parent lets a kid choose, the kid’s next PIN becomes theirs', async () => {
  const fam = await makeFamily('Choose');
  const r = await post(`/api/members/${fam.kid1.id}/choose-pin`, fam.parent.token);
  assert.equal(r.status, 200);
  assert.ok(new Date(r.body.expiresAt) > new Date());

  // The old PIN and old sign-ins stop working.
  assert.equal((await post('/api/auth/refresh', fam.kid1.token)).status, 401);

  const first = await login(fam.code, fam.kid1.name, '7391');
  assert.equal(first.status, 200);
  assert.equal(first.body.passwordCreated, true);
  // From now on only that PIN works — the window is used up.
  assert.equal((await login(fam.code, fam.kid1.name, '1234')).status, 401);
  assert.equal((await login(fam.code, fam.kid1.name, '7391')).status, 200);
});

test('only a parent in the family can do it, and only for kids', async () => {
  const fam = await makeFamily('ChooseRules');
  assert.equal((await post(`/api/members/${fam.kid2.id}/choose-pin`, fam.kid1.token)).status, 403);
  const other = await makeFamily('ChooseOther');
  assert.equal((await post(`/api/members/${fam.kid1.id}/choose-pin`, other.parent.token)).status, 404);
  assert.equal((await post(`/api/members/${fam.parent.id}/choose-pin`, fam.parent.token)).status, 400);
});

// A kid locked out after too many wrong PINs can sign in right after the reset.
const STRICT = process.env.STRICT_API_URL || 'http://127.0.0.1:3997';
async function strict(path: string, body: unknown, token?: string) {
  const r = await fetch(STRICT + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => null) };
}
test('letting a locked-out kid choose a new PIN also lifts the lock (production limits)', async () => {
  const reg = await strict('/api/auth/register', { familyName: uniq('Lock'), name: 'Parent', password: 'parent-pass-1', email: `${uniq('l')}@example.com`, acceptTerms: true, childDataConsent: true });
  const code = reg.body.family.inviteCode;
  const kid = await strict('/api/auth/join', { inviteCode: code, name: 'Kid', password: '1234' });
  for (let i = 0; i < 10; i++) await strict('/api/auth/login', { familyCode: code, name: 'Kid', password: 'wrong' + i });
  assert.equal((await strict('/api/auth/login', { familyCode: code, name: 'Kid', password: '1234' })).status, 429);

  assert.equal((await strict(`/api/members/${kid.body.member.id}/choose-pin`, {}, reg.body.token)).status, 200);
  const r = await strict('/api/auth/login', { familyCode: code, name: 'Kid', password: '5555' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.passwordCreated, true);
});
