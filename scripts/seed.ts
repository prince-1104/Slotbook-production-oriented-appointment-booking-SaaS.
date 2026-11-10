import { and, eq } from 'drizzle-orm';

import { hashPassword } from '@/lib/auth/password';
import { getEnv, requireDatabaseUrl } from '@/lib/config/env-core';
import { createPool } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { createLogger } from '@/lib/logger-core';
import { drizzle } from 'drizzle-orm/node-postgres';

async function main(): Promise<void> {
  const logger = createLogger('slotbook-seed');
  const env = getEnv();

  if (env.APP_ENV === 'production') {
    throw new Error('Refusing to run demo seed when APP_ENV=production.');
  }

  if (!env.ALLOW_DEMO_SEED) {
    logger.info('ALLOW_DEMO_SEED is false; skipping demo seed.');
    return;
  }

  const demoEmail = env.DEMO_HOST_EMAIL;
  const demoPassword = env.DEMO_HOST_PASSWORD;

  if (!demoEmail || !demoPassword) {
    throw new Error(
      'DEMO_HOST_EMAIL and DEMO_HOST_PASSWORD (min 12 chars) must be set when ALLOW_DEMO_SEED=true.',
    );
  }

  const pool = createPool(requireDatabaseUrl(), 2);
  const db = drizzle(pool, { schema });

  try {
    await db.transaction(async (tx) => {
      let [host] = await tx
        .select()
        .from(schema.hosts)
        .where(eq(schema.hosts.slug, 'demo'))
        .limit(1);

      if (!host) {
        const passwordHash = await hashPassword(demoPassword);
        [host] = await tx
          .insert(schema.hosts)
          .values({
            email: demoEmail.toLowerCase(),
            passwordHash,
            name: 'Demo Host',
            slug: 'demo',
            timezone: 'America/New_York',
          })
          .onConflictDoNothing()
          .returning();

        if (!host) {
          [host] = await tx
            .select()
            .from(schema.hosts)
            .where(eq(schema.hosts.slug, 'demo'))
            .limit(1);
        }
      }

      if (!host) {
        throw new Error('Failed to resolve or create demo host.');
      }

      const demoEventTypes = [
        {
          name: 'Quick Chat',
          slug: 'quick-chat',
          durationMinutes: 15,
          capacity: 1,
          bufferBeforeMinutes: 5,
          bufferAfterMinutes: 5,
          minNoticeMinutes: 60,
          maxAdvanceDays: 30,
          isActive: true,
        },
        {
          name: 'Team Workshop',
          slug: 'team-workshop',
          durationMinutes: 60,
          capacity: 5,
          bufferBeforeMinutes: 10,
          bufferAfterMinutes: 10,
          minNoticeMinutes: 1440,
          maxAdvanceDays: 30,
          isActive: true,
        },
      ] as const;

      for (const et of demoEventTypes) {
        await tx
          .insert(schema.eventTypes)
          .values({
            hostId: host.id,
            ...et,
          })
          .onConflictDoNothing({
            target: [schema.eventTypes.hostId, schema.eventTypes.slug],
          });
      }

      // Idempotently ensure Mon-Fri 09:00-17:00 default schedule if host has no weekly windows
      const existingSchedule = await tx
        .select({ id: schema.weeklyAvailability.id })
        .from(schema.weeklyAvailability)
        .where(and(eq(schema.weeklyAvailability.hostId, host.id)))
        .limit(1);

      if (existingSchedule.length === 0) {
        const weekdays = [1, 2, 3, 4, 5]; // ISO Monday..Friday
        await tx.insert(schema.weeklyAvailability).values(
          weekdays.map((dayOfWeek) => ({
            hostId: host.id,
            dayOfWeek,
            startTime: '09:00:00',
            endTime: '17:00:00',
          })),
        );
      }

      logger.info({ hostId: host.id, hostSlug: host.slug }, 'Demo seed ensured idempotently');
    });
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  const logger = createLogger('slotbook-seed');
  logger.fatal({ err }, 'Demo seed failed');
  process.exit(1);
});
