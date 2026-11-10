import 'server-only';

import { and, eq, gt, isNull } from 'drizzle-orm';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';

import { generateOpaqueToken, sha256Hex } from '@/lib/auth/crypto';
import { getEnv } from '@/lib/config/env';
import { getDb, type DbExecutor } from '@/lib/db';
import { hostSessions, hosts } from '@/lib/db/schema';
import { UnauthorizedError } from '@/lib/errors';

export const SESSION_COOKIE_NAME = 'slotbook_session';
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const LAST_SEEN_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export interface AuthenticatedHost {
  id: string;
  email: string;
  name: string;
  slug: string;
  timezone: string;
}

export interface HostSessionContext {
  sessionId: string;
  expiresAt: Date;
  host: AuthenticatedHost;
}

export function buildSessionCookieOptions(maxAgeSeconds = SESSION_TTL_SECONDS) {
  const { APP_URL } = getEnv();
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    secure: APP_URL.startsWith('https://'),
    maxAge: maxAgeSeconds,
  };
}

export async function createHostSession(
  executor: DbExecutor,
  hostId: string,
  meta: { ipAddress?: string | null; userAgent?: string | null },
): Promise<{ rawToken: string; sessionId: string; expiresAt: Date }> {
  const rawToken = generateOpaqueToken(32);
  const tokenHash = sha256Hex(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

  const [created] = await executor
    .insert(hostSessions)
    .values({
      hostId,
      tokenHash,
      expiresAt,
      ipAddress: meta.ipAddress ?? null,
      userAgent: meta.userAgent ?? null,
    })
    .returning({
      id: hostSessions.id,
      expiresAt: hostSessions.expiresAt,
    });

  if (!created) {
    throw new Error('Failed to create host session');
  }

  return {
    rawToken,
    sessionId: created.id,
    expiresAt: created.expiresAt,
  };
}

export async function resolveHostSession(rawToken: string): Promise<HostSessionContext | null> {
  if (!rawToken || rawToken.length < 16) {
    return null;
  }

  const db = getDb();
  const tokenHash = sha256Hex(rawToken);
  const now = new Date();

  const [row] = await db
    .select({
      sessionId: hostSessions.id,
      expiresAt: hostSessions.expiresAt,
      lastSeenAt: hostSessions.lastSeenAt,
      hostId: hosts.id,
      email: hosts.email,
      name: hosts.name,
      slug: hosts.slug,
      timezone: hosts.timezone,
    })
    .from(hostSessions)
    .innerJoin(hosts, eq(hostSessions.hostId, hosts.id))
    .where(
      and(
        eq(hostSessions.tokenHash, tokenHash),
        isNull(hostSessions.revokedAt),
        gt(hostSessions.expiresAt, now),
      ),
    )
    .limit(1);

  if (!row) {
    return null;
  }

  if (now.getTime() - row.lastSeenAt.getTime() > LAST_SEEN_REFRESH_INTERVAL_MS) {
    await db
      .update(hostSessions)
      .set({ lastSeenAt: now })
      .where(and(eq(hostSessions.id, row.sessionId), isNull(hostSessions.revokedAt)));
  }

  return {
    sessionId: row.sessionId,
    expiresAt: row.expiresAt,
    host: {
      id: row.hostId,
      email: row.email,
      name: row.name,
      slug: row.slug,
      timezone: row.timezone,
    },
  };
}

export async function revokeHostSession(rawToken: string): Promise<void> {
  if (!rawToken) return;
  const db = getDb();
  const tokenHash = sha256Hex(rawToken);
  await db
    .update(hostSessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(hostSessions.tokenHash, tokenHash), isNull(hostSessions.revokedAt)));
}

export async function getHostSessionFromCookies(): Promise<HostSessionContext | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!rawToken) {
    return null;
  }
  return resolveHostSession(rawToken);
}

export async function requireHostSession(request: NextRequest): Promise<HostSessionContext> {
  const rawToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!rawToken) {
    throw new UnauthorizedError('SESSION_MISSING', 'Host authentication required');
  }
  const session = await resolveHostSession(rawToken);
  if (!session) {
    throw new UnauthorizedError('SESSION_INVALID', 'Session expired or revoked');
  }
  return session;
}
