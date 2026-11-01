// Converting Kinroost events to Google Calendar's format (no network calls here).

/** The Google Calendar version of one of our events (timed events get a one-hour slot). */
export function googleBody(e: { title: string; date: string; time?: string | null; notes?: string | null }) {
  if (!e.time) {
    // All-day: Google's end date is the day after (exclusive); the same day is rejected as empty.
    const next = new Date(e.date + 'T12:00:00Z');
    next.setUTCDate(next.getUTCDate() + 1);
    return { summary: e.title, description: e.notes || undefined, start: { date: e.date }, end: { date: next.toISOString().slice(0, 10) } };
  }
  const [h, m] = e.time.split(':').map(Number);
  const endH = Math.min(h + 1, 23), endM = h + 1 > 23 ? 59 : m;
  const end = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
  return {
    summary: e.title,
    description: e.notes || undefined,
    start: { dateTime: `${e.date}T${e.time}:00`, timeZone: 'America/Vancouver' },
    end: { dateTime: `${e.date}T${end}:00`, timeZone: 'America/Vancouver' },
  };
}
export const ymdOf = (d: Date) => d.toISOString().slice(0, 10);
