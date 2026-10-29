// Shared helpers for the API test suite. The suite talks to a real API process
// over HTTP, backed by a throwaway PostgreSQL database (see test/run.mjs).
export const BASE = process.env.TEST_API_URL || 'http://127.0.0.1:3999';

export type Res = { status: number; body: any };

export async function call(method: string, path: string, token?: string, body?: unknown): Promise<Res> {
  const r = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  let parsed: any = text;
  try { parsed = text ? JSON.parse(text) : null; } catch { /* keep text */ }
  return { status: r.status, body: parsed };
}

export const get   = (p: string, t?: string) => call('GET', p, t);
export const post  = (p: string, t?: string, b?: unknown) => call('POST', p, t, b ?? {});
export const patch = (p: string, t?: string, b?: unknown) => call('PATCH', p, t, b ?? {});
export const put   = (p: string, t?: string, b?: unknown) => call('PUT', p, t, b ?? {});
export const del   = (p: string, t?: string) => call('DELETE', p, t);

let counter = 0;
export function uniq(prefix: string) {
  counter += 1;
  return `${prefix}${Date.now().toString(36)}${counter}`;
}

export type Account = { token: string; id: string; name: string; password: string };
export type Family = { id: string; code: string; parent: Account; kid1: Account; kid2: Account };

/** Creates a family with one parent and two kids, all with passwords. */
export async function makeFamily(label = 'Fam'): Promise<Family> {
  const parentPw = 'parent-pass-1';
  const reg = await post('/api/auth/register', undefined, { familyName: uniq(label), name: 'Parent', password: parentPw });
  if (reg.status !== 200) throw new Error('register failed: ' + JSON.stringify(reg.body));
  const code = reg.body.family.inviteCode;
  const join = async (name: string): Promise<Account> => {
    const r = await post('/api/auth/join', undefined, { inviteCode: code, name, password: '1234' });
    if (r.status !== 200) throw new Error('join failed: ' + JSON.stringify(r.body));
    return { token: r.body.token, id: r.body.member.id, name, password: '1234' };
  };
  return {
    id: reg.body.family.id,
    code,
    parent: { token: reg.body.token, id: reg.body.member.id, name: 'Parent', password: parentPw },
    kid1: await join('Kid One'),
    kid2: await join('Kid Two'),
  };
}

export async function starsOf(fam: Family, memberId: string): Promise<number> {
  const r = await get('/api/members', fam.parent.token);
  const m = r.body.find((x: any) => x.id === memberId);
  if (!m) throw new Error('member not found');
  return m.stars;
}
