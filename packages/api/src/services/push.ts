// One place that sends a push notification to every device a member uses:
// phones (Expo push service) and browsers (Web Push). Best-effort: a push
// failure is logged and never breaks the action that triggered it.
import { prisma } from '../db';
import { sendBrowserPush } from './webPush';

/** Which preference switch a notification falls under. "general" is always delivered. */
export type PushCategory = 'tasks' | 'rewards' | 'chat' | 'general';
export type PushMessage = { title: string; body: string; url?: string; category?: PushCategory };

const EXPO_PUSH_URL = () => process.env.EXPO_PUSH_URL || 'https://exp.host/--/api/v2/push/send';
const EXPO_TOKEN = /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{10,200}\]$/;
export const isExpoToken = (t: unknown): t is string => typeof t === 'string' && EXPO_TOKEN.test(t);

/** Picks a category from the screen a notification opens, for older callers that don't say. */
export function categoryFor(url = '/'): PushCategory {
  if (url.startsWith('/chores')) return 'tasks';
  if (url.startsWith('/rewards') || url.startsWith('/bank')) return 'rewards';
  if (url.startsWith('/chat')) return 'chat';
  return 'general';
}

/** Guesses which screen a notification should open from its title (for older callers). */
export function urlForTitle(title: string): string {
  if (/reward|bank|screen time|allowance|stars banked/i.test(title)) return '/rewards';
  if (/chore|task|approved|not quite|to check/i.test(title)) return '/chores';
  if (/chat/i.test(title)) return '/chat';
  return '/';
}

type ExpoTicket = { status: 'ok' | 'error'; message?: string; details?: { error?: string } };

/** Sends to a member's phones. Returns how many were accepted; removes phones Expo says are gone. */
async function sendToPhones(memberId: string, msg: Required<PushMessage>): Promise<number> {
  const devices = await prisma.pushDevice.findMany({ where: { memberId } });
  const wanted = devices.filter(d => msg.category === 'general' || d[msg.category]);
  if (!wanted.length) return 0;
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (process.env.EXPO_ACCESS_TOKEN) headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
  const messages = wanted.map(d => ({
    to: d.token,
    title: msg.title,
    body: msg.body,
    sound: 'default',
    channelId: 'default',
    priority: 'high',
    data: { url: msg.url },
  }));
  let accepted = 0;
  // Expo takes up to 100 messages per request.
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 10000);
      const r = await fetch(EXPO_PUSH_URL(), { method: 'POST', headers, body: JSON.stringify(batch), signal: ctl.signal }).finally(() => clearTimeout(timer));
      const json: any = await r.json().catch(() => null);
      const tickets: ExpoTicket[] = Array.isArray(json?.data) ? json.data : [];
      const gone: string[] = [];
      tickets.forEach((t, j) => {
        if (t?.status === 'ok') accepted++;
        else if (t?.details?.error === 'DeviceNotRegistered') gone.push(batch[j].to);
      });
      if (gone.length) await prisma.pushDevice.deleteMany({ where: { token: { in: gone } } });
      if (!r.ok) console.error(`[push] Expo push service answered ${r.status}`);
    } catch (e: any) {
      console.error('[push] Expo push service unreachable:', e?.message || e);
    }
  }
  return accepted;
}

/** Sends one notification to every phone and browser of one member. Never throws. */
export async function pushToMember(memberId: string, message: PushMessage): Promise<{ phones: number; browsers: number }> {
  const url = message.url || urlForTitle(message.title);
  const msg: Required<PushMessage> = {
    title: message.title.slice(0, 120),
    body: message.body.slice(0, 300),
    url,
    category: message.category || categoryFor(url),
  };
  const [phones, browsers] = await Promise.all([
    sendToPhones(memberId, msg).catch(e => { console.error('[push] phones failed', e); return 0; }),
    sendBrowserPush(memberId, msg.title, msg.body, msg.url)
      .then(rs => rs.filter(r => r.sent).length)
      .catch(e => { console.error('[push] browsers failed', e); return 0; }),
  ]);
  return { phones, browsers };
}

/** Saves (or moves) a phone to this member. Whoever signs in on a phone last gets its notifications. */
export async function registerPhone(memberId: string, token: string, platform: string) {
  const p = ['ios', 'android'].includes(platform) ? platform : 'unknown';
  return prisma.pushDevice.upsert({
    where: { token },
    create: { memberId, token, platform: p },
    update: { memberId, platform: p, lastSeenAt: new Date() },
    select: { id: true, tasks: true, rewards: true, chat: true },
  });
}
