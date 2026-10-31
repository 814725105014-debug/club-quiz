import crypto from 'node:crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous characters

export function newId(prefix = ''): string {
  const raw = crypto.randomUUID().replace(/-/g, '');
  return prefix ? `${prefix}_${raw.slice(0, 20)}` : raw.slice(0, 20);
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function randomCode(length = 6): string {
  let out = '';
  const buf = crypto.randomBytes(length);
  for (let i = 0; i < length; i += 1) out += ALPHABET[buf[i] % ALPHABET.length];
  return out;
}

export function numericCode(digits = 6): string {
  const max = 10 ** digits;
  return String(crypto.randomInt(0, max)).padStart(digits, '0');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
