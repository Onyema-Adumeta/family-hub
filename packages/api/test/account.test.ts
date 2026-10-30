// Third batch: email verification and password reset, consent, data export
// and deletion, member removal, health check.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { BASE, get, post, put, del, patch, makeFamily, uniq, mailsTo, linkToken } from './helpers';

const prisma = new PrismaClient();
const base = { familyName: 'Fam', name: 'P', password: 'parent-pass-1', acceptTerms: true, childDataConsent: true };

// ── Sign-up requirements ─────────────────────────────────────────────────────

test('Sign-up needs a valid email and both consents', async () => {
  const email = `${uniq('su')}@example.com`;
  assert.equal((await post('/api/auth/register', undefined, { ...base })).status, 400, 'no email');
  assert.equal((await post('/api/auth/register', undefined, { ...base, email: 'not-an-email' })).status, 400);
  assert.equal((await post('/api/auth/register', undefined, { ...base, email, acceptTerms: false })).status, 400, 'terms not accepted');
  assert.equal((await post('/api/auth/register', undefined, { ...base, email, childDataConsent: undefined })).status, 400, 'no child consent');
  const ok = await post('/api/auth/register', undefined, { ...base, email });
  assert.equal(ok.status, 200);
  const fam = await prisma.family.findUniqueOrThrow({ where: { id: ok.body.family.id } });
  assert.ok(fam.termsAcceptedAt && fam.childConsentAt && fam.termsVersion, 'consent recorded with a version');
  assert.equal(fam.termsAcceptedById, ok.body.member.id);
});

// ── Email verification ───────────────────────────────────────────────────────

test('Sign-up emails a confirmation link; it works once and confirms the address', async () => {
  const fam = await makeFamily('Verify');
  const mails = mailsTo(fam.email);
  assert.equal(mails.length, 1);
  assert.match(mails[0].subject, /Confirm your email/);
  assert.match(mails[0].text, /http:\/\/app\.test\/verify-email\?token=/);
  const token = linkToken(fam.email, 'verify-email')!;

  const me1 = await get('/api/auth/me', fam.parent.token);
  assert.equal(me1.body.member.emailVerifiedAt, null);
  assert.equal((await post('/api/auth/verify-email', undefined, { token })).status, 200);
  const me2 = await get('/api/auth/me', fam.parent.token);
  assert.ok(me2.body.member.emailVerifiedAt);
  assert.equal((await post('/api/auth/verify-email', undefined, { token })).status, 400, 'single use');
  assert.equal((await post('/api/auth/verify-email', undefined, { token: 'x'.repeat(43) })).status, 400, 'made-up token');

  const stored = await prisma.authToken.findMany({ where: { memberId: fam.parent.id } });
  assert.ok(stored.every(t => !t.tokenHash.includes(token)), 'only a hash is stored');
});

async function verifiedFamily(label: string) {
  const fam = await makeFamily(label);
  await post('/api/auth/verify-email', undefined, { token: linkToken(fam.email, 'verify-email') });
  return fam;
}

// ── Email sign-in ────────────────────────────────────────────────────────────

test('Parents can sign in with a confirmed email', async () => {
  const fam = await makeFamily('EmailLogin');
  const before = await post('/api/auth/login', undefined, { email: fam.email, password: fam.parent.password });
  assert.equal(before.status, 401, 'unconfirmed email cannot be used to sign in');
  await post('/api/auth/verify-email', undefined, { token: linkToken(fam.email, 'verify-email') });
  const ok = await post('/api/auth/login', undefined, { email: fam.email.toUpperCase(), password: fam.parent.password });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.member.id, fam.parent.id);
  assert.ok(!('password' in ok.body.member));
  const wrong = await post('/api/auth/login', undefined, { email: fam.email, password: 'nope-nope' });
  assert.equal(wrong.status, 401);
});

// ── Forgot / reset password ──────────────────────────────────────────────────

test('Forgot password: same reply for any email; only confirmed emails get a link', async () => {
  const unverified = await makeFamily('NoVerify');
  const before = mailsTo(unverified.email).length;
  const r1 = await post('/api/auth/forgot-password', undefined, { email: unverified.email });
  const r2 = await post('/api/auth/forgot-password', undefined, { email: `${uniq('nobody')}@example.com` });
  assert.equal(r1.status, 200);
  assert.deepEqual(r1.body, r2.body, 'cannot tell which emails have accounts');
  assert.equal(mailsTo(unverified.email).length, before, 'no reset email for an unconfirmed address');
});

test('Reset link sets a new password, signs out every device, and works only once', async () => {
  const fam = await verifiedFamily('Reset');
  const otherDevice = await post('/api/auth/login', undefined, { familyCode: fam.code, name: 'Parent', password: fam.parent.password });
  assert.equal((await post('/api/auth/forgot-password', undefined, { email: fam.email })).status, 200);
  const token = linkToken(fam.email, 'reset-password');
  assert.ok(token, 'reset email sent');
  assert.match(mailsTo(fam.email).at(-1)!.subject, /Reset your Kinroost password/);

  assert.equal((await post('/api/auth/reset-password', undefined, { token, password: 'ab' })).status, 400, 'too short');
  const ok = await post('/api/auth/reset-password', undefined, { token, password: 'brand-new-pw' });
  assert.equal(ok.status, 200);
  assert.equal((await get('/api/chores', fam.parent.token)).status, 401, 'signed out here');
  assert.equal((await get('/api/chores', otherDevice.body.token)).status, 401, 'and everywhere else');
  assert.equal((await post('/api/auth/login', undefined, { familyCode: fam.code, name: 'Parent', password: fam.parent.password })).status, 401, 'old password gone');
  assert.equal((await post('/api/auth/login', undefined, { familyCode: fam.code, name: 'Parent', password: 'brand-new-pw' })).status, 200);
  assert.equal((await post('/api/auth/reset-password', undefined, { token, password: 'another-one' })).status, 400, 'single use');
});

test('Reset links expire, and only the newest one works', async () => {
  const fam = await verifiedFamily('Expire');
  await post('/api/auth/forgot-password', undefined, { email: fam.email });
  const first = linkToken(fam.email, 'reset-password')!;
  await post('/api/auth/forgot-password', undefined, { email: fam.email });
  const second = linkToken(fam.email, 'reset-password')!;
  assert.notEqual(first, second);
  assert.equal((await post('/api/auth/reset-password', undefined, { token: first, password: 'newpass1' })).status, 400, 'older link replaced');
  await prisma.authToken.updateMany({ where: { memberId: fam.parent.id, purpose: 'reset_password' }, data: { expiresAt: new Date(Date.now() - 1000) } });
  assert.equal((await post('/api/auth/reset-password', undefined, { token: second, password: 'newpass1' })).status, 400, 'expired');
});

test('Changing email needs your password and must be confirmed again', async () => {
  const fam = await verifiedFamily('ChangeEmail');
  const newEmail = `${uniq('new')}@example.com`;
  assert.equal((await put(`/api/members/${fam.parent.id}/email`, fam.parent.token, { email: newEmail, currentPassword: 'wrong' })).status, 400);
  assert.equal((await put(`/api/members/${fam.kid1.id}/email`, fam.parent.token, { email: newEmail, currentPassword: fam.parent.password })).status, 403, 'only your own');
  const r = await put(`/api/members/${fam.parent.id}/email`, fam.parent.token, { email: newEmail, currentPassword: fam.parent.password });
  assert.equal(r.status, 200);
  assert.equal(r.body.member.email, newEmail);
  assert.equal(r.body.member.emailVerifiedAt, null);
  assert.equal(mailsTo(newEmail).length, 1);
  assert.equal((await post('/api/auth/login', undefined, { email: newEmail, password: fam.parent.password })).status, 401, 'not usable until confirmed');
  assert.equal((await post('/api/auth/login', undefined, { email: fam.email, password: fam.parent.password })).status, 401, 'old email no longer signs in');
});

// ── Consent for existing families ────────────────────────────────────────────

test('Families without consent: parents are asked, new members cannot join until accepted', async () => {
  const fam = await makeFamily('Legacy');
  await prisma.family.update({ where: { id: fam.id }, data: { termsAcceptedAt: null, termsVersion: null, childConsentAt: null } });
  const settings = await get('/api/family', fam.kid1.token);
  assert.equal(settings.body.needsConsent, true);
  assert.equal(settings.body.planLabel, 'Free beta');

  const blocked = await post('/api/auth/join', undefined, { inviteCode: fam.code, name: 'Newbie', password: '1234' });
  assert.equal(blocked.status, 403);

  assert.equal((await post('/api/family/consent', fam.kid1.token, { acceptTerms: true, childDataConsent: true })).status, 403, 'kids cannot consent');
  assert.equal((await post('/api/family/consent', fam.parent.token, { acceptTerms: true })).status, 400, 'both boxes needed');
  assert.equal((await post('/api/family/consent', fam.parent.token, { acceptTerms: true, childDataConsent: true })).status, 200);
  assert.equal((await get('/api/family', fam.kid1.token)).body.needsConsent, false);
  assert.equal((await post('/api/auth/join', undefined, { inviteCode: fam.code, name: 'Newbie', password: '1234' })).status, 200);
});

// ── Data export ──────────────────────────────────────────────────────────────

test('Export: parents only, password required, everything included, secrets left out', async () => {
  const fam = await makeFamily('Export');
  await post('/api/chores', fam.parent.token, { title: 'Export me', stars: 3, frequency: 'weekly', assigneeIds: [fam.kid1.id] });
  await post('/api/chat', fam.kid1.token, { text: 'hello export' });
  await prisma.family.update({ where: { id: fam.id }, data: { googleTokens: 'enc:v1:secret' } });

  assert.equal((await post('/api/family/export', fam.kid1.token, { password: '1234' })).status, 403);
  assert.equal((await post('/api/family/export', fam.parent.token, { password: 'wrong' })).status, 400);
  const r = await post('/api/family/export', fam.parent.token, { password: fam.parent.password });
  assert.equal(r.status, 200);
  assert.equal(r.body.members.length, 3);
  assert.ok(r.body.chores.some((c: any) => c.title === 'Export me'));
  assert.ok(r.body.messages.some((m: any) => m.text === 'hello export'));
  assert.equal(r.body.family.googleCalendarConnected, true);
  const text = JSON.stringify(r.body);
  for (const secret of ['"password"', 'tokenVersion', 'pushToken', 'enc:v1', 'tokenHash', '$2a$', '$2b$']) {
    assert.ok(!text.includes(secret), `export contains ${secret}`);
  }
  const other = await makeFamily('ExportOther');
  const otherExport = await post('/api/family/export', other.parent.token, { password: other.parent.password });
  assert.ok(!JSON.stringify(otherExport.body).includes('Export me'), 'only your own family');
});

// ── Deleting a family ────────────────────────────────────────────────────────

async function busyFamily(label: string) {
  const fam = await makeFamily(label);
  const t = fam.parent.token;
  const chore = await post('/api/chores', t, { title: 'c', stars: 5, frequency: 'weekly', assigneeIds: [fam.kid1.id] });
  await patch(`/api/chores/${chore.body.id}`, fam.kid1.token, { status: 'done' });
  const reward = await post('/api/rewards', t, { name: 'r', cost: 1 });
  await post(`/api/rewards/redeem/${reward.body.id}`, fam.kid1.token);
  const msg = await post('/api/chat', fam.kid1.token, { text: 'hi', });
  await post(`/api/chat/${msg.body.id}/ack`, fam.kid2.token, { kind: 'seen' });
  await post('/api/meals', t, { name: 'm', day: 'Mon', week: '2026-W44', assigneeIds: [fam.kid1.id] });
  await post('/api/events', t, { title: 'e', date: '2026-11-01', assignedToId: fam.kid1.id });
  await post('/api/grocery', fam.kid1.token, { name: 'g' });
  await post('/api/quests', t, { title: 'q', memberId: fam.kid1.id });
  await post(`/api/wishlist/${fam.kid1.id}`, fam.kid1.token, { title: 'w' });
  await post('/api/rules', t, { assignedToId: fam.kid1.id, minStars: 5 });
  await post('/api/games/score', fam.kid1.token, { gameType: 'memory', score: 10 });
  const trip = await post('/api/trips', fam.kid1.token, { title: 't', startDate: '2026-12-01', endDate: '2026-12-02' });
  await post(`/api/trips/${trip.body.id}/packing`, fam.kid1.token, { name: 'socks' });
  const day = await post(`/api/trips/${trip.body.id}/days`, t, { date: '2026-12-01' });
  await post(`/api/trips/days/${day.body.id}/activities`, t, { title: 'hike', assigneeIds: [fam.kid1.id] });
  await post('/api/notifications/broadcast', t, { title: 'n', body: 'b' });
  return fam;
}

test('Delete family: needs password and exact name; removes everything; other families untouched', async () => {
  const fam = await busyFamily('Doomed');
  const other = await busyFamily('Survivor');

  assert.equal((await post('/api/family/delete', fam.kid1.token, { password: '1234', confirmName: fam.name })).status, 403);
  assert.equal((await post('/api/family/delete', fam.parent.token, { password: 'wrong', confirmName: fam.name })).status, 400);
  assert.equal((await post('/api/family/delete', fam.parent.token, { password: fam.parent.password, confirmName: 'nope' })).status, 400);
  assert.ok(await prisma.family.findUnique({ where: { id: fam.id } }), 'nothing deleted after a failed attempt');

  const r = await post('/api/family/delete', fam.parent.token, { password: fam.parent.password, confirmName: fam.name });
  assert.equal(r.status, 200, JSON.stringify(r.body));

  const where = { where: { familyId: fam.id } };
  const counts = {
    family: await prisma.family.count({ where: { id: fam.id } }),
    members: await prisma.member.count(where), chores: await prisma.chore.count(where), completions: await prisma.choreCompletion.count(where),
    rewards: await prisma.reward.count(where), redemptions: await prisma.redemption.count(where), messages: await prisma.message.count(where),
    meals: await prisma.meal.count(where), events: await prisma.event.count(where), grocery: await prisma.groceryItem.count(where),
    quests: await prisma.quest.count(where), rules: await prisma.weeklyRule.count(where), scores: await prisma.gameScore.count(where),
    trips: await prisma.trip.count(where), notifications: await prisma.notification.count(where), audit: await prisma.auditLog.count(where),
    wishlist: await prisma.wishlistItem.count({ where: { memberId: { in: [fam.parent.id, fam.kid1.id, fam.kid2.id] } } }),
  };
  for (const [k, v] of Object.entries(counts)) assert.equal(v, 0, `${k} left behind`);
  assert.equal((await get('/api/chores', fam.parent.token)).status, 401, 'deleted accounts are signed out');

  const survivor = await post('/api/family/export', other.parent.token, { password: other.parent.password });
  assert.equal(survivor.status, 200);
  assert.equal(survivor.body.members.length, 3);
  assert.ok(survivor.body.chores.length > 0 && survivor.body.trips.length > 0 && survivor.body.messages.length > 0);
});

test('Removing a member with lots of activity works and hands shared items to the parent', async () => {
  const fam = await busyFamily('Removal');
  const r = await del(`/api/members/${fam.kid1.id}`, fam.parent.token);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(await prisma.member.count({ where: { id: fam.kid1.id } }), 0);
  const trips = await get('/api/trips', fam.parent.token);
  assert.equal(trips.body[0].createdBy.id, fam.parent.id, 'trip kept, handed to the parent');
  const grocery = await get('/api/grocery', fam.parent.token);
  assert.equal(grocery.body[0].addedBy.id, fam.parent.id);
  assert.equal((await get('/api/chores', fam.kid2.token)).status, 200, 'rest of the family fine');
});

// ── Health check for monitoring ──────────────────────────────────────────────

test('Readiness check reports the database', async () => {
  const r = await fetch(BASE + '/health/ready');
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.db, 'ok');
});

test.after(() => prisma.$disconnect());
