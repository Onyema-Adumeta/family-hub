// One-time links for email verification and password reset.
import crypto from 'crypto';
import { prisma } from '../db';
import { appUrl, buttonEmail, sendMail } from './mailer';

export type Purpose = 'verify_email' | 'reset_password';
const LIFETIME_MS: Record<Purpose, number> = {
  verify_email: 24 * 60 * 60 * 1000,   // 24 hours
  reset_password: 60 * 60 * 1000,      // 1 hour
};

const hash = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

/** Creates a token (stores only its hash) and returns the raw token for the email link. */
export async function issueToken(memberId: string, purpose: Purpose, email: string | null) {
  // Only the newest link of each kind works.
  await prisma.authToken.deleteMany({ where: { memberId, purpose, usedAt: null } });
  const token = crypto.randomBytes(32).toString('base64url');
  await prisma.authToken.create({
    data: { memberId, purpose, email, tokenHash: hash(token), expiresAt: new Date(Date.now() + LIFETIME_MS[purpose]) },
  });
  return token;
}

/** Marks a valid, unused, unexpired token as used and returns it; null otherwise. */
export async function consumeToken(raw: unknown, purpose: Purpose) {
  if (typeof raw !== 'string' || raw.length < 20 || raw.length > 200) return null;
  const row = await prisma.authToken.findUnique({ where: { tokenHash: hash(raw) } });
  if (!row || row.purpose !== purpose || row.usedAt || row.expiresAt < new Date()) return null;
  const claimed = await prisma.authToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
  return claimed.count === 1 ? row : null;
}

export async function sendVerificationEmail(member: { id: string; name: string; email: string | null }) {
  if (!member.email) return false;
  const token = await issueToken(member.id, 'verify_email', member.email);
  const url = appUrl(`/verify-email?token=${encodeURIComponent(token)}`);
  const body = buttonEmail({
    heading: 'Confirm your email for Kinroost',
    lines: [`Hi ${member.name},`, 'Please confirm this is your email address. You will use it to sign in and to reset your password if you forget it.'],
    button: 'Confirm my email',
    url,
    footer: 'This link works for 24 hours. If you did not create a Kinroost account, you can ignore this email.',
  });
  return sendMail({ to: member.email, subject: 'Confirm your email for Kinroost', ...body });
}

export async function sendResetEmail(email: string, accounts: { id: string; name: string; familyName: string }[]) {
  const links: string[] = [];
  for (const a of accounts) {
    const token = await issueToken(a.id, 'reset_password', email);
    links.push(`${a.name} in ${a.familyName}: ${appUrl(`/reset-password?token=${encodeURIComponent(token)}`)}`);
  }
  const first = links[0].split(': ').slice(1).join(': ');
  const body = buttonEmail({
    heading: 'Reset your Kinroost password',
    lines: [
      'Someone asked to reset the password for the Kinroost account linked to this email.',
      ...(accounts.length > 1 ? ['This email is used by more than one account:', ...links] : []),
    ],
    button: 'Choose a new password',
    url: first,
    footer: 'This link works for 1 hour and can be used once. If you did not ask for this, you can ignore this email — your password has not changed.',
  });
  return sendMail({ to: email, subject: 'Reset your Kinroost password', ...body });
}
