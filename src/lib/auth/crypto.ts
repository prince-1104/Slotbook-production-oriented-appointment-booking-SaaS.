import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from 'node:crypto';

import { requireSessionSecret } from '@/lib/config/env-core';

const HKDF_SALT = Buffer.from('slotbook-hkdf-v1', 'utf8');
const CIPHER_PREFIX = 'v1';

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function generateOpaqueToken(byteLength = 32): string {
  return randomBytes(byteLength).toString('base64url');
}

function deriveSubkey(secret: string, info: string): Buffer {
  const raw = hkdfSync(
    'sha256',
    Buffer.from(secret, 'utf8'),
    HKDF_SALT,
    Buffer.from(info, 'utf8'),
    32,
  );
  return Buffer.from(raw);
}

export function sealJson(payload: unknown, info: string, secretOverride?: string): string {
  const secret = secretOverride ?? requireSessionSecret();
  const key = deriveSubkey(secret, info);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    CIPHER_PREFIX,
    iv.toString('base64url'),
    authTag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.');
}

export function unsealJson<T>(sealed: string, info: string, secretOverride?: string): T {
  const parts = sealed.split('.');
  if (parts.length !== 4 || parts[0] !== CIPHER_PREFIX) {
    throw new Error('Invalid encrypted payload envelope');
  }

  const [, ivB64, tagB64, dataB64] = parts;
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('Malformed encrypted payload segments');
  }

  const secret = secretOverride ?? requireSessionSecret();
  const key = deriveSubkey(secret, info);
  const iv = Buffer.from(ivB64, 'base64url');
  const authTag = Buffer.from(tagB64, 'base64url');
  const ciphertext = Buffer.from(dataB64, 'base64url');

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8')) as T;
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  const sortedKeys = Object.keys(record).sort();
  const entries = sortedKeys
    .filter((k) => record[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(record[k])}`);
  return `{${entries.join(',')}}`;
}
