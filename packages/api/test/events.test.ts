// Editing calendar events.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { get, post, patch, makeFamily } from './helpers';
import { googleBody } from '../src/services/googleCalendar';

async function newEvent(fam: Awaited<ReturnType<typeof makeFamily>>) {
  const r = await post('/api/events', fam.parent.token, { title: 'Dentist', date: '2026-11-10', time: '09:00', notes: 'Bring card' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body;
}

test('an event can be edited: title, date, time, notes and who it is for', async () => {
  const fam = await makeFamily('EvEdit');
  const ev = await newEvent(fam);
  const r = await patch(`/api/events/${ev.id}`, fam.parent.token, { title: 'Dentist (moved)', date: '2026-11-12', time: '14:30', notes: '', assignedToId: fam.kid1.id });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.title, 'Dentist (moved)');
  assert.equal(r.body.date.slice(0, 10), '2026-11-12');
  assert.equal(r.body.time, '14:30');
  assert.equal(r.body.notes, null);
  assert.equal(r.body.assignedToId, fam.kid1.id);
  assert.equal(r.body.googleUpdated, null); // not linked to Google

  // Clearing the time makes it an all-day event; only the sent fields change.
  const allDay = await patch(`/api/events/${ev.id}`, fam.parent.token, { time: null });
  assert.equal(allDay.body.time, null);
  assert.equal(allDay.body.title, 'Dentist (moved)');
  const list = await get('/api/events', fam.parent.token);
  assert.ok(list.body.some((e: any) => e.id === ev.id && e.time === null));
});

test('bad edits are refused', async () => {
  const fam = await makeFamily('EvBad');
  const ev = await newEvent(fam);
  for (const body of [{ title: '' }, { date: '12/11/2026' }, { time: '25:00' }, { assignedToId: 'nobody' }, {}]) {
    assert.equal((await patch(`/api/events/${ev.id}`, fam.parent.token, body)).status, 400, JSON.stringify(body));
  }
});

test('another family cannot edit the event', async () => {
  const fam = await makeFamily('EvMine');
  const other = await makeFamily('EvTheirs');
  const ev = await newEvent(fam);
  assert.equal((await patch(`/api/events/${ev.id}`, other.parent.token, { title: 'Hacked' })).status, 404);
  // …nor assign it to someone in their family.
  assert.equal((await patch(`/api/events/${ev.id}`, fam.parent.token, { assignedToId: other.kid1.id })).status, 400);
});

test('Google Calendar gets a valid time range', () => {
  const allDay = googleBody({ title: 'Trip', date: '2026-12-31' });
  assert.deepEqual(allDay.start, { date: '2026-12-31' });
  assert.deepEqual(allDay.end, { date: '2027-01-01' }); // exclusive end: the next day
  const timed = googleBody({ title: 'Soccer', date: '2026-11-05', time: '16:30' });
  assert.equal((timed.start as any).dateTime, '2026-11-05T16:30:00');
  assert.equal((timed.end as any).dateTime, '2026-11-05T17:30:00');
  const late = googleBody({ title: 'Late', date: '2026-11-05', time: '23:30' });
  assert.equal((late.end as any).dateTime, '2026-11-05T23:59:00');
});
