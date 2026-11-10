import { migrate } from 'drizzle-orm/node-postgres/migrator';
import path from 'node:path';

import { requireDatabaseUrl } from '@/lib/config/env-core';
import { createPool } from '@/lib/db';
import { createLogger } from '@/lib/logger-core';
import { drizzle } from 'drizzle-orm/node-postgres';

async function main(): Promise<void> {
  const logger = createLogger('slotbook-migrate');
  const databaseUrl = requireDatabaseUrl();
  const pool = createPool(databaseUrl, 2);

  try {
    const db = drizzle(pool);
    const migrationsFolder = path.resolve(process.cwd(), 'src/lib/db/migrations');
    logger.info({ migrationsFolder }, 'Running PostgreSQL migrations');
    await migrate(db, { migrationsFolder });
    logger.info('Database migrations completed successfully');
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  const logger = createLogger('slotbook-migrate');
  logger.fatal({ err }, 'Database migration failed');
  process.exit(1);
});
