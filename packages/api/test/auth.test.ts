import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { get, post, patch, put, del, makeFamily, uniq } from './helpers';

const prisma = new PrismaClient();
const SECRET_FIELDS = ['password', 'pushToken', 'lastLat', 'lastLng', 'lastSeenAt'];

test('D01: register requires a password', async () => {
  const r = await post('/api/auth/register', undefined, { familyName: uniq('NoPw'), name: 'P' });
  assert.equal(r.status, 400);
});

test('D01: login needs the right password; wrong password and unknown name give the same error', async () => {
  const fam = await makeFamily('Login');
  const ok = await post('/api/auth/login', undefined, { familyCode: fam.code, name: 'parent', password: fam.parent.password });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.token);

  const noPw = await post('/api/auth/login', undefined, { familyCode: fam.code, name: 'Parent' });
  assert.equal(noPw.status, 400, 'missing password rejected');

  const wrong = await post('/api/auth/login', undefined, { familyCode: fam.code, name: 'Parent', password: 'wrong-pass' });
  const nobody = await post('/api/auth/login', undefined, { familyCode: fam.code, name: 'Nobody', password: 'wrong-pass' });
  const badCode = await post('/api/auth/login', undefined, { familyCode: 'FAM-ZZZZZZ', name: 'Parent', password: 'wrong-pass' });
  assert.equal(wrong.status, 401);
  assert.equal(nobody.status, 401);
  assert.equal(badCode.status, 401);
  assert.equal(wrong.body.error, nobody.body.error);
  assert.equal(wrong.body.error, badCode.body.error);

  const kid = await post('/api/auth/login', undefined, { familyCode: fam.code, name: 'Kid One', password: '1234' });
  assert.equal(kid.status, 200);
});

test('D01: accounts from before passwords set their password on first sign-in, then it is required', async () => {
  const fam = await makeFamily('Legacy');
  await prisma.member.update({ where: { id: fam.kid1.id }, data: { password: '' } });

  const first = await post('/api/auth/login', undefined, { familyCode: fam.code, name: 'Kid One', password: 'new-pin-9' });
  assert.equal(first.status, 200);
  assert.equal(first.body.passwordCreated, true);

  const wrong = await post('/api/auth/login', undefined, { familyCode: fam.code, name: 'Kid One', password: 'something-else' });
  assert.equal(wrong.status, 401, 'cannot be claimed twice');
  const right = await post('/api/auth/login', undefined, { familyCode: fam.code, name: 'Kid One', password: 'new-pin-9' });
  assert.equal(right.status, 200);
  assert.equal(right.body.passwordCreated, false);

  const row = await prisma.member.findUniqueOrThrow({ where: { id: fam.kid1.id } });
  assert.ok(row.password.startsWith('$2'), 'stored as a bcrypt hash, not plain text');
});

test('D01: joining with the invite code always creates a kid, even if "parent" is requested', async () => {
  const fam = await makeFamily('JoinRole');
  const r = await post('/api/auth/join', undefined, { inviteCode: fam.code, name: 'Sneaky', password: 'abcd', role: 'parent' });
  assert.equal(r.status, 200);
  assert.equal(r.body.member.role, 'child');
});

test('D06: no endpoint returns password hashes, push tokens, location or Google tokens', async () => {
  const fam = await makeFamily('Leak');
  const members = await get('/api/members', fam.parent.token);
  assert.equal(members.status, 200);
  for (const m of members.body) for (const f of SECRET_FIELDS) assert.ok(!(f in m), `members list leaks ${f}`);

  const me = await get('/api/auth/me', fam.kid1.token);
  for (const f of SECRET_FIELDS) assert.ok(!(f in me.body.member), `/me leaks ${f}`);
  assert.ok(!('googleTokens' in me.body.family), '/me leaks googleTokens');

  const login = await post('/api/auth/login', undefined, { familyCode: fam.code, name: 'Parent', password: fam.parent.password });
  for (const f of SECRET_FIELDS) assert.ok(!(f in login.body.member), `login leaks ${f}`);
  assert.ok(!('googleTokens' in login.body.family), 'login leaks googleTokens');

  const edited = await patch(`/api/members/${fam.kid1.id}`, fam.parent.token, { emoji: '🦊' });
  assert.equal(edited.status, 200);
  for (const f of SECRET_FIELDS) assert.ok(!(f in edited.body), `member update leaks ${f}`);
});

test('D23: new family codes are long and random, and parents can rotate them', async () => {
  const fam = await makeFamily('Rotate');
  assert.match(fam.code, /^FAM-[A-HJ-NP-Z2-9]{6}$/);

  const kidTry = await post('/api/auth/rotate-code', fam.kid1.token);
  assert.equal(kidTry.status, 403);

  const r = await post('/api/auth/rotate-code', fam.parent.token);
  assert.equal(r.status, 200);
  const newCode = r.body.family.inviteCode;
  assert.notEqual(newCode, fam.code);

  const oldLogin = await post('/api/auth/login', undefined, { familyCode: fam.code, name: 'Parent', password: fam.parent.password });
  assert.equal(oldLogin.status, 401);
  const newLogin = await post('/api/auth/login', undefined, { familyCode: newCode, name: 'Parent', password: fam.parent.password });
  assert.equal(newLogin.status, 200);
  const stillIn = await get('/api/chores', fam.kid1.token);
  assert.equal(stillIn.status, 200, 'existing sessions keep working');
});

test('Passwords: change your own (needs current), parent can reset a kid, kid cannot reset others', async () => {
  const fam = await makeFamily('Pw');
  const noCurrent = await put(`/api/members/${fam.kid1.id}/password`, fam.kid1.token, { password: 'brand-new' });
  assert.equal(noCurrent.status, 400);
  const own = await put(`/api/members/${fam.kid1.id}/password`, fam.kid1.token, { password: 'brand-new', currentPassword: '1234' });
  assert.equal(own.status, 200);

  const kidResetsSibling = await put(`/api/members/${fam.kid2.id}/password`, fam.kid1.token, { password: 'hacked1' });
  assert.equal(kidResetsSibling.status, 403);
  const kidResetsParent = await put(`/api/members/${fam.parent.id}/password`, fam.kid1.token, { password: 'hacked1' });
  assert.equal(kidResetsParent.status, 403);

  const parentReset = await put(`/api/members/${fam.kid2.id}/password`, fam.parent.token, { password: 'reset-9' });
  assert.equal(parentReset.status, 200);
  const login = await post('/api/auth/login', undefined, { familyCode: fam.code, name: 'Kid Two', password: 'reset-9' });
  assert.equal(login.status, 200);

  const other = await makeFamily('PwOther');
  const crossReset = await put(`/api/members/${fam.kid1.id}/password`, other.parent.token, { password: 'hacked1' });
  assert.equal(crossReset.status, 404, 'a parent in another family cannot reset this kid');
});

test('Roles: a parent can promote a member, and the change applies to their existing session', async () => {
  const fam = await makeFamily('Role');
  const before = await post('/api/rewards', fam.kid1.token, { name: 'Ice cream', cost: 5 });
  assert.equal(before.status, 403);

  const kidPromotes = await patch(`/api/members/${fam.kid2.id}/role`, fam.kid1.token, { role: 'parent' });
  assert.equal(kidPromotes.status, 403);

  const promote = await patch(`/api/members/${fam.kid1.id}/role`, fam.parent.token, { role: 'parent' });
  assert.equal(promote.status, 200);
  const after = await post('/api/rewards', fam.kid1.token, { name: 'Ice cream', cost: 5 });
  assert.equal(after.status, 200, 'same token, new role');
});

test('Removed members are signed out immediately', async () => {
  const fam = await makeFamily('Removed');
  const r = await del(`/api/members/${fam.kid2.id}`, fam.parent.token);
  assert.equal(r.status, 200);
  const after = await get('/api/chores', fam.kid2.token);
  assert.equal(after.status, 401);
});

test('Unauthenticated and forged tokens are rejected', async () => {
  assert.equal((await get('/api/chores')).status, 401);
  const forged = 'eyJhbGciOiJIUzI1NiJ9.eyJtZW1iZXJJZCI6IngiLCJmYW1pbHlJZCI6InkiLCJyb2xlIjoicGFyZW50In0.bad';
  assert.equal((await get('/api/chores', forged)).status, 401);
});

test.after(() => prisma.$disconnect());
