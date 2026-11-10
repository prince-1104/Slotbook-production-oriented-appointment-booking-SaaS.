import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { POST as loginPost } from '@/app/api/v1/auth/login/route';
import { POST as logoutPost } from '@/app/api/v1/auth/logout/route';
import { GET as meGet } from '@/app/api/v1/auth/me/route';
import { PUT as settingsPut } from '@/app/api/v1/host/settings/route';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import { auditLogs, hostSessions } from '@/lib/db/schema';
import { consumeRateLimit } from '@/lib/rate-limit/pg-rate-limiter';

import {
  createTestHost,
  ensureMigrated,
  makeJsonRequest,
  resetDatabase,
  teardownIntegrationDb,
} from './helpers';

describe('Phase 2: Host Auth, Revocable Sessions, CSRF & PG Rate Limiting', () => {
  beforeAll(async () => {
    await ensureMigrated();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await teardownIntegrationDb();
  });

  it('authenticates host with Argon2id, issues revocable DB session, updates timezone, and revokes on logout', async () => {
    const host = await createTestHost({
      email: 'alice@slotbook.test',
      password: 'StrongPassword123!',
      timezone: 'America/New_York',
    });

    // 1. Login succeeds and sets HttpOnly session cookie
    const loginRes = await loginPost(
      makeJsonRequest('/api/v1/auth/login', {
        method: 'POST',
        origin: 'http://localhost:3000',
        ip: '10.0.0.10',
        body: { email: 'alice@slotbook.test', password: 'StrongPassword123!' },
      }),
    );

    expect(loginRes.status).toBe(200);
    const cookieHeader = loginRes.headers.get('set-cookie');
    expect(cookieHeader).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(cookieHeader?.toLowerCase()).toContain('httponly');
    expect(cookieHeader?.toLowerCase()).toContain('samesite=lax');

    const sessionCookie = cookieHeader!.split(';')[0]!;

    // 2. GET /api/v1/auth/me validates session against PostgreSQL
    const meRes = await meGet(
      makeJsonRequest('/api/v1/auth/me', {
        method: 'GET',
        cookie: sessionCookie,
      }),
    );
    expect(meRes.status).toBe(200);
    const meJson = (await meRes.json()) as { data: { host: { id: string; timezone: string } } };
    expect(meJson.data.host.id).toBe(host.id);
    expect(meJson.data.host.timezone).toBe('America/New_York');

    // 3. Invalid timezone rejected with 422
    const badTzRes = await settingsPut(
      makeJsonRequest('/api/v1/host/settings', {
        method: 'PUT',
        origin: 'http://localhost:3000',
        cookie: sessionCookie,
        body: { name: 'Alice', timezone: 'Mars/Phobos' },
      }),
    );
    expect(badTzRes.status).toBe(422);

    // 4. Valid timezone persisted + audit logged
    const goodTzRes = await settingsPut(
      makeJsonRequest('/api/v1/host/settings', {
        method: 'PUT',
        origin: 'http://localhost:3000',
        cookie: sessionCookie,
        body: { name: 'Alice Updated', timezone: 'Europe/London' },
      }),
    );
    expect(goodTzRes.status).toBe(200);
    const goodTzJson = (await goodTzRes.json()) as {
      data: { host: { name: string; timezone: string } };
    };
    expect(goodTzJson.data.host.name).toBe('Alice Updated');
    expect(goodTzJson.data.host.timezone).toBe('Europe/London');

    const db = getDb();
    const audits = await db.select().from(auditLogs).where(eq(auditLogs.hostId, host.id));
    expect(audits.map((a) => a.action)).toContain('host.settings_updated');

    // 5. Logout revokes session row immediately
    const logoutRes = await logoutPost(
      makeJsonRequest('/api/v1/auth/logout', {
        method: 'POST',
        origin: 'http://localhost:3000',
        cookie: sessionCookie,
        body: {},
      }),
    );
    expect(logoutRes.status).toBe(200);

    const sessions = await db.select().from(hostSessions).where(eq(hostSessions.hostId, host.id));
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.revokedAt).not.toBeNull();

    // 6. Reusing the old cookie after logout fails with 401
    const afterLogoutMe = await meGet(
      makeJsonRequest('/api/v1/auth/me', {
        method: 'GET',
        cookie: sessionCookie,
      }),
    );
    expect(afterLogoutMe.status).toBe(401);
  });

  it('rejects cross-origin CSRF attempts and enforces PostgreSQL login rate limiting (429)', async () => {
    await createTestHost({
      email: 'bob@slotbook.test',
      password: 'StrongPassword123!',
    });

    // Cross-origin request rejected before touching rate limit / auth
    const csrfRes = await loginPost(
      makeJsonRequest('/api/v1/auth/login', {
        method: 'POST',
        origin: 'https://attacker.example',
        ip: '10.0.0.50',
        body: { email: 'bob@slotbook.test', password: 'wrong' },
      }),
    );
    expect(csrfRes.status).toBe(403);

    // 5 failed login attempts allowed (401), 6th blocked by PostgreSQL rate limiter (429)
    for (let i = 0; i < 5; i++) {
      const res = await loginPost(
        makeJsonRequest('/api/v1/auth/login', {
          method: 'POST',
          origin: 'http://localhost:3000',
          ip: '10.0.0.99',
          body: { email: 'bob@slotbook.test', password: 'wrong-password' },
        }),
      );
      expect(res.status).toBe(401);
    }

    const rateLimitedRes = await loginPost(
      makeJsonRequest('/api/v1/auth/login', {
        method: 'POST',
        origin: 'http://localhost:3000',
        ip: '10.0.0.99',
        body: { email: 'bob@slotbook.test', password: 'StrongPassword123!' },
      }),
    );
    expect(rateLimitedRes.status).toBe(429);
    expect(Number(rateLimitedRes.headers.get('retry-after'))).toBeGreaterThanOrEqual(1);
  });

  it('enforces PostgreSQL rate limit buckets accurately under concurrent requests', async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        consumeRateLimit({
          key: 'test:concurrent:bucket',
          limit: 4,
          windowSeconds: 60,
        }),
      ),
    );

    const allowedCount = results.filter((r) => r.allowed).length;
    const blockedCount = results.filter((r) => !r.allowed).length;
    expect(allowedCount).toBe(4);
    expect(blockedCount).toBe(6);
  });
});
