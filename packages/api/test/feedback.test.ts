// In-app feedback and beta applications from the landing page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { post, makeFamily, uniq } from './helpers';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

test('anyone in a family can send feedback; it is saved with who and where', async () => {
  const fam = await makeFamily('Feedback');
  const r = await post('/api/feedback', fam.kid1.token, { kind: 'idea', message: 'Can chores have stickers?', page: '/chores', device: 'android 1.2.0' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const saved = await db.feedback.findUnique({ where: { id: r.body.id } });
  assert.equal(saved?.familyId, fam.id);
  assert.equal(saved?.memberId, fam.kid1.id);
  assert.equal(saved?.role, 'child');
  assert.equal(saved?.page, '/chores');
});

test('feedback needs a sign-in and a real message', async () => {
  const fam = await makeFamily('FeedbackBad');
  assert.equal((await post('/api/feedback', undefined, { message: 'Hello there' })).status, 401);
  assert.equal((await post('/api/feedback', fam.parent.token, { message: ' ' })).status, 400);
  assert.equal((await post('/api/feedback', fam.parent.token, { message: 'x'.repeat(2001) })).status, 400);
  assert.equal((await post('/api/feedback', fam.parent.token, { kind: 'rant', message: 'Hello there' })).status, 400);
});

test('deleting the family deletes its feedback', async () => {
  const fam = await makeFamily('FeedbackGone');
  const r = await post('/api/feedback', fam.parent.token, { kind: 'bug', message: 'Something broke' });
  await db.family.delete({ where: { id: fam.id } }).catch(async () => {
    // Members point at the family; remove them the way the app does.
    const { deleteFamilyData } = await import('../src/services/familyData');
    await deleteFamilyData(fam.id);
  });
  assert.equal(await db.feedback.findUnique({ where: { id: r.body.id } }), null);
});

const application = (email: string) => ({
  parentName: '  Ada   Lovelace ', email, country: 'Canada', region: 'BC', kids: '7, 10', devices: 'Android, web',
  why: 'Mornings are chaos', heardFrom: 'Facebook group',
});

test('a beta application is saved; applying again updates it instead of duplicating', async () => {
  const email = `${uniq('beta')}@Example.com`;
  assert.equal((await post('/api/beta-applications', undefined, application(email))).status, 200);
  assert.equal((await post('/api/beta-applications', undefined, { ...application(email), kids: '7, 10, 12' })).status, 200);
  const rows = await db.betaApplication.findMany({ where: { email: email.toLowerCase() } });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].parentName, 'Ada Lovelace');
  assert.equal(rows[0].kids, '7, 10, 12');
  assert.equal(rows[0].status, 'new');
});

test('bad beta applications are refused, and bots filling the hidden field are ignored', async () => {
  const email = `${uniq('bot')}@example.com`;
  assert.equal((await post('/api/beta-applications', undefined, { ...application(email), email: 'nope' })).status, 400);
  assert.equal((await post('/api/beta-applications', undefined, { ...application(email), country: 'Mars' })).status, 400);
  assert.equal((await post('/api/beta-applications', undefined, { ...application(email), parentName: '' })).status, 400);
  const bot = await post('/api/beta-applications', undefined, { ...application(email), website: 'http://spam.example' });
  assert.equal(bot.status, 200);
  assert.equal(await db.betaApplication.count({ where: { email } }), 0);
});
