import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import { verifyPassword } from '@/lib/auth/password';
import type { DbClient } from '@/lib/db';
import { auditLogs, hosts } from '@/lib/db/schema';
import { assertValidIanaTimeZone } from '@/lib/domain/timezone';
import { NotFoundError, UnauthorizedError, ValidationError } from '@/lib/errors';

export const loginInputSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1).max(200),
});

export const updateHostSettingsSchema = z.object({
  name: z.string().trim().min(1).max(120),
  timezone: z.string().trim().min(1).max(100),
});

export interface PublicHostProfile {
  id: string;
  email: string;
  name: string;
  slug: string;
  timezone: string;
}

export async function authenticateHostCredentials(
  db: DbClient,
  input: z.infer<typeof loginInputSchema>,
): Promise<PublicHostProfile> {
  const [host] = await db.select().from(hosts).where(eq(hosts.email, input.email)).limit(1);

  if (!host) {
    throw new UnauthorizedError('INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const valid = await verifyPassword(host.passwordHash, input.password);
  if (!valid) {
    throw new UnauthorizedError('INVALID_CREDENTIALS', 'Invalid email or password');
  }

  return {
    id: host.id,
    email: host.email,
    name: host.name,
    slug: host.slug,
    timezone: host.timezone,
  };
}

export async function getHostProfile(db: DbClient, hostId: string): Promise<PublicHostProfile> {
  const [host] = await db
    .select({
      id: hosts.id,
      email: hosts.email,
      name: hosts.name,
      slug: hosts.slug,
      timezone: hosts.timezone,
    })
    .from(hosts)
    .where(eq(hosts.id, hostId))
    .limit(1);

  if (!host) {
    throw new NotFoundError('HOST_NOT_FOUND', 'Host not found');
  }

  return host;
}

export async function updateHostSettings(
  db: DbClient,
  hostId: string,
  input: z.infer<typeof updateHostSettingsSchema>,
  meta: { ipAddress?: string | null; requestId?: string | null },
): Promise<PublicHostProfile> {
  const parsed = updateHostSettingsSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(
      'VALIDATION_ERROR',
      'Invalid host settings payload',
      z.flattenError(parsed.error),
    );
  }

  const validTimezone = assertValidIanaTimeZone(parsed.data.timezone);

  return db.transaction(async (tx) => {
    // Level 2 lock: synchronize host timezone/config edits with active booking/reschedule reads
    const lockedResult = await tx.execute(sql`
      SELECT id, email, name, slug, timezone
      FROM hosts
      WHERE id = ${hostId}
      FOR UPDATE
    `);

    const lockedHost = lockedResult.rows[0] as
      { id: string; email: string; name: string; slug: string; timezone: string } | undefined;

    if (!lockedHost) {
      throw new NotFoundError('HOST_NOT_FOUND', 'Host not found');
    }

    const [updated] = await tx
      .update(hosts)
      .set({
        name: parsed.data.name,
        timezone: validTimezone,
        updatedAt: new Date(),
      })
      .where(eq(hosts.id, hostId))
      .returning({
        id: hosts.id,
        email: hosts.email,
        name: hosts.name,
        slug: hosts.slug,
        timezone: hosts.timezone,
      });

    if (!updated) {
      throw new NotFoundError('HOST_NOT_FOUND', 'Host not found');
    }

    await tx.insert(auditLogs).values({
      hostId,
      action: 'host.settings_updated',
      details: {
        previousTimezone: lockedHost.timezone,
        newTimezone: updated.timezone,
        nameChanged: lockedHost.name !== updated.name,
      },
      ipAddress: meta.ipAddress ?? null,
      requestId: meta.requestId ?? null,
    });

    return updated;
  });
}
