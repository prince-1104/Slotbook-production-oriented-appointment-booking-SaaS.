import { describe, expect, it } from 'vitest';

import {
  canonicalJson,
  generateOpaqueToken,
  sealJson,
  sha256Hex,
  unsealJson,
} from '@/lib/auth/crypto';
import { assertValidCsrf } from '@/lib/auth/csrf';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { resetEnvCache } from '@/lib/config/env-core';
import { ForbiddenError, UnsupportedMediaTypeError, ValidationError } from '@/lib/errors';
import { assertValidIanaTimeZone, isValidIanaTimeZone } from '@/lib/domain/timezone';

describe('crypto & password utilities', () => {
  it('seals and unseals AES-256-GCM JSON payloads with domain separation', () => {
    const secret = 'a'.repeat(64);
    const payload = { managementToken: 'tok_secret_123', bookingId: 'b1' };
    const sealed = sealJson(payload, 'idempotency-secrets', secret);

    expect(sealed.startsWith('v1.')).toBe(true);
    expect(sealed).not.toContain('tok_secret_123');

    const unsealed = unsealJson<typeof payload>(sealed, 'idempotency-secrets', secret);
    expect(unsealed).toEqual(payload);

    // Wrong domain info or wrong secret fails authentication tag verification
    expect(() => unsealJson(sealed, 'other-domain', secret)).toThrow();
    expect(() => unsealJson(sealed, 'idempotency-secrets', 'b'.repeat(64))).toThrow();
  });

  it('produces deterministic canonical JSON regardless of object key order', () => {
    const a = canonicalJson({ b: 2, a: { y: 1, x: 2 }, z: undefined });
    const b = canonicalJson({ a: { x: 2, y: 1 }, b: 2 });
    expect(a).toBe(b);
    expect(sha256Hex(a)).toBe(sha256Hex(b));
  });

  it('generates high-entropy URL-safe tokens and verifies Argon2id passwords', async () => {
    const t1 = generateOpaqueToken(32);
    const t2 = generateOpaqueToken(32);
    expect(t1).not.toBe(t2);
    expect(t1.length).toBeGreaterThanOrEqual(40);

    const hash = await hashPassword('CorrectHorseBatteryStaple!');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(await verifyPassword(hash, 'CorrectHorseBatteryStaple!')).toBe(true);
    expect(await verifyPassword(hash, 'wrong-password')).toBe(false);
  });
});

describe('CSRF verification', () => {
  it('accepts matching same-origin JSON requests and rejects mismatched origin or non-JSON', () => {
    process.env.APP_URL = 'http://localhost:3000';
    resetEnvCache();

    const validReq = new Request('http://localhost:3000/api/v1/auth/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'http://localhost:3000',
      },
    });
    expect(() => assertValidCsrf(validReq)).not.toThrow();

    const badOriginReq = new Request('http://localhost:3000/api/v1/auth/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://evil.example',
      },
    });
    expect(() => assertValidCsrf(badOriginReq)).toThrow(ForbiddenError);

    const formReq = new Request('http://localhost:3000/api/v1/auth/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        origin: 'http://localhost:3000',
      },
    });
    expect(() => assertValidCsrf(formReq)).toThrow(UnsupportedMediaTypeError);
  });
});

describe('Temporal IANA timezone validation', () => {
  it('accepts canonical IANA timezones and rejects invalid zones or raw offsets', () => {
    expect(isValidIanaTimeZone('America/New_York')).toBe(true);
    expect(isValidIanaTimeZone('Asia/Kolkata')).toBe(true);
    expect(isValidIanaTimeZone('UTC')).toBe(true);

    expect(isValidIanaTimeZone('+05:30')).toBe(false);
    expect(isValidIanaTimeZone('Mars/Olympus_Mons')).toBe(false);
    expect(() => assertValidIanaTimeZone('Invalid/Zone')).toThrow(ValidationError);
  });
});
