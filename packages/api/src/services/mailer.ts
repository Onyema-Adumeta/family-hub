// Sends email over SMTP. Works with any provider; the beta uses Gmail:
//
//   SMTP_HOST=smtp.gmail.com  SMTP_PORT=465  SMTP_SECURE=true
//   SMTP_USER=yourname@gmail.com  SMTP_PASS=<16-character Gmail app password>
//   EMAIL_FROM="FamilyHub <yourname@gmail.com>"
//   APP_URL=https://family-hub-web-omega.vercel.app   (where links in emails point)
//
// Switching to Resend, Brevo, Google Workspace etc. later is just these settings.
// EMAIL_OUTBOX_DIR (tests only) writes each email to a JSON file instead of sending.
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

export type Mail = { to: string; subject: string; text: string; html?: string };

let transport: nodemailer.Transporter | null = null;
function smtp() {
  if (transport) return transport;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  const port = Number(SMTP_PORT || 465);
  transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: SMTP_SECURE ? SMTP_SECURE === 'true' : port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transport;
}

export function emailConfigured() {
  return !!process.env.EMAIL_OUTBOX_DIR || smtp() !== null;
}

export function appUrl(pathname: string) {
  const base = (process.env.APP_URL || process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/+$/, '');
  return base + pathname;
}

/** Sends an email. Returns false (and logs) instead of throwing, so a mail problem never breaks sign-up. */
export async function sendMail(mail: Mail): Promise<boolean> {
  try {
    const outbox = process.env.EMAIL_OUTBOX_DIR;
    if (outbox) {
      fs.mkdirSync(outbox, { recursive: true });
      const file = path.join(outbox, `${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
      fs.writeFileSync(file, JSON.stringify(mail));
      return true;
    }
    const t = smtp();
    if (!t) {
      console.warn(`[email] SMTP not configured; would have sent "${mail.subject}" to ${mail.to}`);
      return false;
    }
    await t.sendMail({ from: process.env.EMAIL_FROM || process.env.SMTP_USER, ...mail });
    return true;
  } catch (e) {
    console.error('[email] send failed', e);
    return false;
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** Simple, accessible email layout with one button. */
export function buttonEmail(opts: { heading: string; lines: string[]; button: string; url: string; footer: string }) {
  const html = `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#1f2937">
<h2 style="margin:0 0 12px">${esc(opts.heading)}</h2>
${opts.lines.map(l => `<p style="margin:0 0 12px;line-height:1.5">${esc(l)}</p>`).join('\n')}
<p style="margin:20px 0"><a href="${esc(opts.url)}" style="background:#6366F1;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">${esc(opts.button)}</a></p>
<p style="margin:0 0 12px;font-size:13px;color:#6b7280">Or copy this link: ${esc(opts.url)}</p>
<p style="margin:16px 0 0;font-size:12px;color:#9ca3af">${esc(opts.footer)}</p></div>`;
  const text = [opts.heading, '', ...opts.lines, '', `${opts.button}: ${opts.url}`, '', opts.footer].join('\n');
  return { html, text };
}
