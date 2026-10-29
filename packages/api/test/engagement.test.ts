// Step 1 — bring families back: levels and badges, once-a-day streaks,
// photo-proof approval, family goals, Weekly Wins and the morning briefing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { get, post, patch, makeFamily, starsOf, type Family } from './helpers';

const prisma = new PrismaClient();
const member = (fam: Family, id: string) => get('/api/members', fam.parent.token).then(r => r.body.find((m: any) => m.id === id));
const chore = (fam: Family, body: any) => post('/api/chores', fam.parent.token, { frequency: 'weekly', ...body }).then(r => r.body);

// ── Levels and badges ────────────────────────────────────────────────────────

test('Levels use lifetime stars: earning raises them, spending does not lower them', async () => {
  const fam = await makeFamily('Lvl');
  const c = await chore(fam, { title: 'Big job', stars: 60, assigneeIds: [fam.kid1.id] });
  const r = await patch(`/api/chores/${c.id}`, fam.kid1.token, { status: 'done' });
  assert.equal(r.status, 200);
  const cel = r.body.celebrations.find((x: any) => x.memberId === fam.kid1.id);
  assert.ok(cel, 'celebration returned to the app');
  assert.deepEqual(cel.levelUp, { level: 2, title: 'Helper' });
  const codes = cel.badges.map((b: any) => b.code).sort();
  assert.deepEqual(codes, ['first_chore', 'star_50']);

  const reward = await post('/api/rewards', fam.parent.token, { name: 'Toy', cost: 40 });
  await post(`/api/rewards/redeem/${reward.body.id}`, fam.kid1.token);
  const m = await member(fam, fam.kid1.id);
  assert.equal(m.stars, 20, 'spendable stars went down');
  assert.equal(m.lifetimeStars, 60, 'lifetime stars did not');

  const achievements = await prisma.achievement.findMany({ where: { memberId: fam.kid1.id } });
  assert.equal(achievements.length, 3, 'two badges and one level recorded');
  const note = await get('/api/notifications', fam.kid1.token);
  assert.ok(note.body.some((n: any) => /Level up/.test(n.title)));

  const c2 = await chore(fam, { title: 'Small job', stars: 1, assigneeIds: [fam.kid1.id] });
  const r2 = await patch(`/api/chores/${c2.id}`, fam.kid1.token, { status: 'done' });
  assert.equal(r2.body.celebrations.length, 0, 'no repeat celebrations');
});

test('A parent undo takes back lifetime stars too', async () => {
  const fam = await makeFamily('LvlUndo');
  const c = await chore(fam, { title: 'x', stars: 30, assigneeIds: [fam.kid1.id] });
  await patch(`/api/chores/${c.id}`, fam.kid1.token, { status: 'done' });
  await patch(`/api/chores/${c.id}`, fam.parent.token, { status: 'pending' });
  const m = await member(fam, fam.kid1.id);
  assert.equal(m.stars, 0);
  assert.equal(m.lifetimeStars, 0);
});

test('Streaks count days, not chores (Muse D11)', async () => {
  const fam = await makeFamily('Streak');
  for (let i = 0; i < 3; i++) {
    const c = await chore(fam, { title: `c${i}`, stars: 1, assigneeIds: [fam.kid1.id] });
    await patch(`/api/chores/${c.id}`, fam.kid1.token, { status: 'done' });
  }
  const m = await prisma.member.findUniqueOrThrow({ where: { id: fam.kid1.id } });
  assert.equal(m.streakDays, 1, 'three chores today is a 1-day streak');
  assert.equal(m.totalChoresDone, 3);

  // Yesterday's streak continues today; a gap starts over.
  await prisma.member.update({ where: { id: fam.kid2.id }, data: { streakDays: 4, streakUpdatedAt: new Date(Date.now() - 24 * 3600 * 1000) } });
  const c = await chore(fam, { title: 'y', stars: 1, assigneeIds: [fam.kid2.id] });
  await patch(`/api/chores/${c.id}`, fam.kid2.token, { status: 'done' });
  assert.equal((await prisma.member.findUniqueOrThrow({ where: { id: fam.kid2.id } })).streakDays, 5);
  await prisma.member.update({ where: { id: fam.kid2.id }, data: { streakDays: 9, streakUpdatedAt: new Date(Date.now() - 3 * 24 * 3600 * 1000) } });
  const c2 = await chore(fam, { title: 'z', stars: 1, assigneeIds: [fam.kid2.id] });
  await patch(`/api/chores/${c2.id}`, fam.kid2.token, { status: 'done' });
  assert.equal((await prisma.member.findUniqueOrThrow({ where: { id: fam.kid2.id } })).streakDays, 1);
});

test('Quests count toward levels', async () => {
  const fam = await makeFamily('QLvl');
  const q = await post('/api/quests', fam.parent.token, { title: 'Read', stars: 55, memberId: fam.kid1.id });
  const r = await post(`/api/quests/${q.body.id}/complete`, fam.kid1.token);
  assert.equal(r.status, 200);
  assert.equal(r.body.celebrations[0]?.levelUp?.level, 2);
  assert.equal((await member(fam, fam.kid1.id)).lifetimeStars, 55);
});

// ── Photo proof: kid submits, parent approves, stars land ────────────────────

test('Proof-required chores wait for a parent, who approves or sends back (Muse D10)', async () => {
  const fam = await makeFamily('Proof');
  const c = await chore(fam, { title: 'Clean room', stars: 8, proofRequired: true, assigneeIds: [fam.kid1.id] });

  const noPhoto = await patch(`/api/chores/${c.id}`, fam.kid1.token, { status: 'done' });
  assert.equal(noPhoto.status, 400, 'photo required');

  const sent = await patch(`/api/chores/${c.id}`, fam.kid1.token, { status: 'done', proofUrl: 'https://example.com/room.jpg' });
  assert.equal(sent.status, 200);
  assert.equal(sent.body.status, 'review');
  assert.equal(sent.body.awaitingApproval, true);
  assert.equal(await starsOf(fam, fam.kid1.id), 0, 'no stars yet');
  assert.equal((await patch(`/api/chores/${c.id}`, fam.kid1.token, { status: 'done' })).status, 409, 'already waiting');

  assert.equal((await get('/api/chores/awaiting-approval', fam.kid1.token)).status, 403);
  const queue = await get('/api/chores/awaiting-approval', fam.parent.token);
  assert.equal(queue.body.length, 1);
  assert.equal(queue.body[0].submittedBy.id, fam.kid1.id);
  const parentNotes = await get('/api/notifications', fam.parent.token);
  assert.ok(parentNotes.body.some((n: any) => /Chore to check/.test(n.title)));

  assert.equal((await post(`/api/chores/${c.id}/approve`, fam.kid1.token)).status, 403, 'kids cannot approve');
  const other = await makeFamily('ProofOther');
  assert.equal((await post(`/api/chores/${c.id}/approve`, other.parent.token)).status, 404, 'other families cannot');

  const back = await post(`/api/chores/${c.id}/reject`, fam.parent.token, { note: 'Bed still messy' });
  assert.equal(back.status, 200);
  assert.equal(back.body.status, 'pending');
  assert.equal(back.body.reviewNote, 'Bed still messy');
  assert.equal(back.body.proofUrl, null, 'needs a new photo');
  assert.equal(await starsOf(fam, fam.kid1.id), 0);

  await patch(`/api/chores/${c.id}`, fam.kid1.token, { status: 'done', proofUrl: 'https://example.com/room2.jpg' });
  const ok = await post(`/api/chores/${c.id}/approve`, fam.parent.token);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.status, 'done');
  assert.equal(ok.body.completedById, fam.kid1.id, 'credited to the kid, not the parent');
  assert.equal(await starsOf(fam, fam.kid1.id), 8, 'stars land on approval');
  assert.ok(ok.body.celebrations.some((x: any) => x.memberId === fam.kid1.id));
  assert.equal((await post(`/api/chores/${c.id}/approve`, fam.parent.token)).status, 409, 'approve once');
  assert.equal(await starsOf(fam, fam.kid1.id), 8);
  const log = await get('/api/family/audit', fam.parent.token);
  assert.ok(log.body.some((e: any) => /approved Kid One's "Clean room"/.test(e.summary)));
});

test('A parent can still complete a proof chore directly', async () => {
  const fam = await makeFamily('ProofParent');
  const c = await chore(fam, { title: 'Yard', stars: 4, proofRequired: true, assigneeIds: [fam.kid1.id] });
  const r = await patch(`/api/chores/${c.id}`, fam.parent.token, { status: 'done' });
  assert.equal(r.body.status, 'done');
  assert.equal(await starsOf(fam, fam.kid1.id), 4);
});

// ── Family goal ──────────────────────────────────────────────────────────────

test('Family goal: parents set it, everyone fills it, it is reached once', async () => {
  const fam = await makeFamily('Goal');
  assert.equal((await post('/api/goals', fam.kid1.token, { title: 'x', targetStars: 5 })).status, 403);
  const g = await post('/api/goals', fam.parent.token, { title: 'Movie night', reward: 'Pizza', targetStars: 20 });
  assert.equal(g.status, 200);
  assert.equal(g.body.progress, 0);

  const a = await chore(fam, { title: 'a', stars: 12, assigneeIds: [fam.kid1.id] });
  await patch(`/api/chores/${a.id}`, fam.kid1.token, { status: 'done' });
  let goal = (await get('/api/goals', fam.kid2.token)).body.active;
  assert.equal(goal.progress, 12);
  assert.equal(goal.remaining, 8);
  assert.equal(goal.reachedAt, null);

  const b = await chore(fam, { title: 'b', stars: 10, assigneeIds: [fam.kid2.id] });
  await patch(`/api/chores/${b.id}`, fam.kid2.token, { status: 'done' });
  goal = (await get('/api/goals', fam.kid2.token)).body.active;
  assert.ok(goal.reachedAt, 'reached');
  assert.equal(goal.pct, 100);
  const notes = await get('/api/notifications', fam.kid1.token);
  assert.equal(notes.body.filter((n: any) => /Family goal reached/.test(n.title)).length, 1, 'announced once');

  const other = await makeFamily('GoalOther');
  assert.equal((await get('/api/goals', other.parent.token)).body.active, null, 'not visible to other families');
});

// ── Weekly Wins and briefing ────────────────────────────────────────────────

test('Weekly Wins celebrates the week from real completions', async () => {
  const fam = await makeFamily('Wins');
  const a = await chore(fam, { title: 'a', stars: 9, assigneeIds: [fam.kid1.id] });
  const b = await chore(fam, { title: 'b', stars: 4, assigneeIds: [fam.kid2.id] });
  await patch(`/api/chores/${a.id}`, fam.kid1.token, { status: 'done' });
  await patch(`/api/chores/${b.id}`, fam.kid2.token, { status: 'done' });
  const w = await get('/api/insights/wins', fam.kid2.token);
  assert.equal(w.status, 200);
  assert.equal(w.body.isCurrentWeek, true);
  assert.equal(w.body.family.stars, 13);
  assert.equal(w.body.family.chores, 2);
  const star = w.body.awards.find((x: any) => x.title === 'Star of the week');
  assert.equal(star.memberId, fam.kid1.id);
  assert.ok(w.body.highlights.some((h: string) => /13 stars/.test(h)));
  assert.ok(w.body.members.find((m: any) => m.id === fam.kid1.id).achievements.length > 0);

  const other = await makeFamily('WinsOther');
  assert.equal((await get('/api/insights/wins', other.parent.token)).body.family.stars, 0, 'only your own family');
});

test('Morning briefing summarises today for each person', async () => {
  const fam = await makeFamily('Brief');
  await chore(fam, { title: 'Feed the cat', stars: 2, frequency: 'daily', assigneeIds: [fam.kid1.id] });
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Vancouver', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const [y, m, d] = today.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const monday = new Date(Date.UTC(y, m - 1, d + (dow === 0 ? -6 : 1 - dow))).toISOString().slice(0, 10);
  const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dow];
  await post('/api/meals', fam.parent.token, { name: 'Tacos', emoji: '🌮', day: dayName, slot: 'dinner', week: monday });
  await post('/api/events', fam.parent.token, { title: 'Soccer', date: today, time: '16:00' });

  const r = await get('/api/insights/briefing', fam.kid1.token);
  assert.equal(r.status, 200);
  assert.match(r.body.summary, /Kid One/);
  assert.match(r.body.summary, /1 chore for you today/);
  assert.match(r.body.summary, /Tacos for dinner/);
  assert.match(r.body.summary, /1 thing on the calendar \(first at 16:00\)/);
  const kid = r.body.people.find((p: any) => p.id === fam.kid1.id);
  assert.equal(kid.choresToday[0].title, 'Feed the cat');
  assert.equal(kid.level, 1);
  assert.ok(!('password' in kid));
});

test.after(() => prisma.$disconnect());
