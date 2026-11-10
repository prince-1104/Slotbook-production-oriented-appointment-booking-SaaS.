import fs from 'node:fs';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { NextRequest } from 'next/server';

import { hashPassword } from '@/lib/auth/password';
import { resetEnvCache } from '@/lib/config/env-core';
import { closePool, getDb } from '@/lib/db';
import { hosts } from '@/lib/db/schema';

export function loadLocalEnvForTests(): void {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') {
    process.loadEnvFile(envPath);
  }
  process.env.APP_ENV = 'test';
  process.env.APP_URL = process.env.APP_URL ?? 'http://localhost:3000';
  process.env.SESSION_SECRET =
    process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32
      ? process.env.SESSION_SECRET
      : 'test-session-secret-minimum-32-chars-slotbook';
  resetEnvCache();
}

export async function ensureMigrated(): Promise<void> {
  loadLocalEnvForTests();
  const db = getDb();
  await migrate(db, {
    migrationsFolder: path.resolve(process.cwd(), 'src/lib/db/migrations'),
  });
}

export async function resetDatabase(): Promise<void> {
  const db = getDb();
  await db.execute(sql`
    TRUNCATE TABLE
      audit_logs,
      outbox_events,
      idempotency_records,
      bookings,
      booking_slots,
      date_override_windows,
      date_overrides,
      weekly_availability,
      event_types,
      host_sessions,
      rate_limit_buckets,
      hosts
    RESTART IDENTITY CASCADE
  `);
}

export async function teardownIntegrationDb(): Promise<void> {
  await closePool();
}

export async function createTestHost(overrides?: {
  email?: string;
  password?: string;
  name?: string;
  slug?: string;
  timezone?: string;
}) {
  const db = getDb();
  const suffix = crypto.randomUUID().slice(0, 8);
  const passwordHash = await hashPassword(overrides?.password ?? 'HostSecret123!');

  const [host] = await db
    .insert(hosts)
    .values({
      email: overrides?.email ?? `host-${suffix}@slotbook.test`,
      passwordHash,
      name: overrides?.name ?? `Host ${suffix}`,
      slug: overrides?.slug ?? `host-${suffix}`,
      timezone: overrides?.timezone ?? 'America/New_York',
    })
    .returning();

  if (!host) {
    throw new Error('Failed to insert test host');
  }
  return host;
}

export function makeJsonRequest(
  urlPath: string,
  options: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: unknown;
    cookie?: string;
    origin?: string;
    ip?: string;
    idempotencyKey?: string;
    contentType?: string;
  },
): NextRequest {
  const headers = new Headers();
  if (options.method !== 'GET') {
    headers.set('content-type', options.contentType ?? 'application/json');
  }
  if (options.origin) {
    headers.set('origin', options.origin);
  }
  if (options.cookie) {
    headers.set('cookie', options.cookie);
  }
  if (options.ip) {
    headers.set('x-forwarded-for', options.ip);
  }
  if (options.idempotencyKey) {
    headers.set('idempotency-key', options.idempotencyKey);
  }
  headers.set('x-request-id', crypto.randomUUID());

  return new NextRequest(`http://localhost:3000${urlPath}`, {
    method: options.method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}
