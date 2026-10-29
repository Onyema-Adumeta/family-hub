// Date helpers that work in the family's time zone (Vancouver for now).
export const FAMILY_TZ = 'America/Vancouver';
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** YYYY-MM-DD for an instant, in the family's time zone. */
export function ymd(d = new Date(), tz = FAMILY_TZ) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

function offsetMinutes(at: Date, tz = FAMILY_TZ) {
  const part = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' })
    .formatToParts(at).find(p => p.type === 'timeZoneName')?.value || 'GMT';
  const m = part.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!m) return 0;
  const mins = Number(m[2]) * 60 + Number(m[3] || 0);
  return m[1] === '-' ? -mins : mins;
}

/** The instant that is 00:00 on `day` (YYYY-MM-DD) in the family's time zone. */
export function startOfDay(day: string, tz = FAMILY_TZ) {
  const [y, mo, d] = day.split('-').map(Number);
  const guess = new Date(Date.UTC(y, mo - 1, d, 12));
  return new Date(Date.UTC(y, mo - 1, d) - offsetMinutes(guess, tz) * 60000);
}

export function addDays(day: string, n: number) {
  const [y, mo, d] = day.split('-').map(Number);
  const t = new Date(Date.UTC(y, mo - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/** Monday of the week containing `day`, as YYYY-MM-DD (matches the meal planner's week key). */
export function mondayOf(day: string) {
  const [y, mo, d] = day.split('-').map(Number);
  const dow = new Date(Date.UTC(y, mo - 1, d)).getUTCDay(); // 0 = Sunday
  return addDays(day, dow === 0 ? -6 : 1 - dow);
}

export function dayName(day: string) {
  const [y, mo, d] = day.split('-').map(Number);
  return DAY_NAMES[new Date(Date.UTC(y, mo - 1, d)).getUTCDay()];
}

/** Local hour (0–23) right now in the family's time zone. */
export function localHour(d = new Date(), tz = FAMILY_TZ) {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }).format(d));
}
