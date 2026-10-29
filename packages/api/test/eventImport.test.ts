// Step 4 — zero-typing scheduling: snap a flyer or paste an email.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BASE, get, post, put, makeFamily } from './helpers';

const FAKE_AI = process.env.FAKE_AI_URL!;
const aiRequests = async () => (await fetch(FAKE_AI + '/__captured')).json() as Promise<any[]>;
const resetAi = () => fetch(FAKE_AI + '/__reset', { method: 'POST' });
// A tiny valid PNG (1x1 pixel).
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Vancouver', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

test('Needs AI switched on, and a photo or text', async () => {
  const fam = await makeFamily('Imp');
  assert.equal((await post('/api/events/extract', fam.parent.token, { text: 'Picture day Jan 12' })).status, 403);
  await put('/api/family/ai-consent', fam.parent.token, { enabled: true });
  assert.equal((await post('/api/events/extract', fam.parent.token, {})).status, 400);
  assert.equal((await post('/api/events/extract', fam.parent.token, { image: { mediaType: 'application/pdf', data: PNG } })).status, 400);
  assert.equal((await post('/api/events/extract', undefined, { text: 'x' })).status, 401);
});

test('A pasted email becomes proposed events; bad ones dropped; duplicates flagged; nothing added yet', async () => {
  const fam = await makeFamily('ImpText');
  await put('/api/family/ai-consent', fam.parent.token, { enabled: true });
  await post('/api/events', fam.parent.token, { title: 'Soccer practice', date: today, time: '16:00' });
  await resetAi();
  const r = await post('/api/events/extract', fam.kid1.token, { text: 'Dear families, picture day is January 12 at 9am in the gym. Soccer practice today at 4.' });
  assert.equal(r.status, 200);
  assert.equal(r.body.events.length, 2, 'the item without a real date is dropped');
  const pic = r.body.events.find((e: any) => e.title === 'School picture day');
  assert.deepEqual([pic.date, pic.time, pic.location, pic.possibleDuplicate], ['2027-01-12', '09:00', 'Gym', false]);
  assert.equal(r.body.events.find((e: any) => e.title === 'Soccer practice').possibleDuplicate, true);
  const sent = await aiRequests();
  assert.ok(!JSON.stringify(sent).includes('Kid One') && !JSON.stringify(sent).includes(fam.email), 'no family details added to the request');
  const events = await get('/api/events', fam.parent.token);
  assert.equal(events.body.length, 1, 'nothing added until confirmed');
});

test('A flyer photo is sent as an image (bigger than the normal 50 kB limit)', async () => {
  const fam = await makeFamily('ImpPhoto');
  await put('/api/family/ai-consent', fam.parent.token, { enabled: true });
  await resetAi();
  const big = PNG + 'A'.repeat(200_000 - (PNG.length % 4 === 0 ? 0 : PNG.length % 4)); // ~150 kB of base64 padding
  const r = await fetch(BASE + '/api/events/extract', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + fam.parent.token },
    body: JSON.stringify({ image: { mediaType: 'image/png', data: big.slice(0, big.length - (big.length % 4)) } }),
  });
  assert.equal(r.status, 200);
  const sent = await aiRequests();
  const block = sent[0].messages[0].content.find((c: any) => c.type === 'image');
  assert.equal(block.source.media_type, 'image/png');
});

test('Confirming adds the reviewed events in one go', async () => {
  const fam = await makeFamily('ImpAdd');
  assert.equal((await post('/api/events/batch', fam.parent.token, { events: [] })).status, 400);
  assert.equal((await post('/api/events/batch', fam.parent.token, { events: [{ title: 'x', date: 'soon' }] })).status, 400);
  const r = await post('/api/events/batch', fam.parent.token, { events: [
    { title: 'Picture day', date: '2027-01-12', time: '09:00', location: 'Gym', emoji: '📸' },
    { title: 'Book fair', date: '2027-01-15' },
  ] });
  assert.equal(r.status, 200);
  assert.equal(r.body.created, 2);
  const events = await get('/api/events', fam.kid1.token);
  const pic = events.body.find((e: any) => e.title === 'Picture day');
  assert.equal(pic.time, '09:00');
  assert.match(pic.notes, /Gym/);
  assert.equal(pic.source, 'import');
  const other = await makeFamily('ImpAddOther');
  assert.equal((await get('/api/events', other.parent.token)).body.length, 0, 'added to this family only');
  const log = await get('/api/family/audit', fam.parent.token);
  assert.ok(log.body.some((e: any) => /added 2 events from a photo or message/.test(e.summary)));
});
