// Rules for anything that leaves Kinroost for an outside AI provider.
//
// 1. A parent must switch AI features on for the family (Family.aiConsentAt).
//    Until then, no family data is sent anywhere.
// 2. Real names never leave the server. Members are sent as "Parent 1",
//    "Child 2" etc., and labels in the reply are swapped back to names here.
// 3. Birthdays and exact ages never leave the server — only a broad age band.
import { prisma } from '../db';

export const AI_OFF_MESSAGE = 'AI features are off for this family. A parent can turn them on in Settings.';

export async function aiAllowed(familyId: string): Promise<boolean> {
  if (!process.env.ANTHROPIC_API_KEY) return false;
  const family = await prisma.family.findUnique({ where: { id: familyId }, select: { aiConsentAt: true } });
  return !!family?.aiConsentAt;
}

export function ageYears(birthday: Date | null): number | null {
  if (!birthday) return null;
  return Math.floor((Date.now() - birthday.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}

/** A broad band only — never an exact age. */
export function ageBand(birthday: Date | null, role: string): string {
  if (role === 'parent') return 'adult';
  const age = ageYears(birthday);
  if (age === null) return 'child';
  if (age < 7) return 'young child';
  if (age < 11) return 'child';
  if (age < 14) return 'preteen';
  if (age < 18) return 'teenager';
  return 'adult';
}

type Named = { name: string; role: string };

/** Assigns stable labels ("Parent 1", "Child 1"…) to members, and can swap labels back to names. */
export function makeLabeller<T extends Named>(members: T[]) {
  let p = 0, c = 0;
  const labels = new Map<T, string>();
  for (const m of members) labels.set(m, m.role === 'parent' ? `Parent ${++p}` : `Child ${++c}`);
  const label = (m: T) => labels.get(m)!;
  /** Replace labels in AI output with the real names (done on our server, not the provider's). */
  const restore = (text: string) => {
    let out = text;
    // Longest labels first so "Child 10" is not partly replaced by "Child 1".
    const pairs = [...labels.entries()].sort((a, b) => b[1].length - a[1].length);
    for (const [m, l] of pairs) out = out.split(l).join(m.name);
    return out;
  };
  return { label, restore };
}
