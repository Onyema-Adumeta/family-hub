// Encrypts secrets we must store (Google Calendar tokens) with AES-256-GCM.
// Key: TOKEN_ENCRYPTION_KEY env var — any long random string (it is hashed to 32 bytes).
// Generate one with:  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
import crypto from 'crypto';

const PREFIX = 'enc:v1:';

function key(): Buffer | null {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw || raw.length < 16) return null;
  return crypto.createHash('sha256').update(raw).digest();
}

export function encryptionConfigured() {
  return key() !== null;
}

export function isEncrypted(value: string | null | undefined) {
  return !!value && value.startsWith(PREFIX);
}

export function encryptSecret(plain: string): string {
  const k = key();
  if (!k) throw new Error('TOKEN_ENCRYPTION_KEY is not set');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', k, iv);
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, body]).toString('base64');
}

/** Decrypts a stored value. Values saved before encryption existed are returned as-is. */
export function decryptSecret(stored: string): string {
  if (!isEncrypted(stored)) return stored;
  const k = key();
  if (!k) throw new Error('TOKEN_ENCRYPTION_KEY is not set, cannot read encrypted value');
  const raw = Buffer.from(stored.slice(PREFIX.length), 'base64');
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const body = raw.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', k, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
}
