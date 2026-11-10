import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { requireDatabaseUrl } from '@/lib/config/env-core';
import * as schema from '@/lib/db/schema';

export type DbSchema = typeof schema;
export type DbClient = NodePgDatabase<DbSchema>;
export type DbTransaction = Parameters<Parameters<DbClient['transaction']>[0]>[0];
export type DbExecutor = DbClient | DbTransaction;

declare global {
  var __slotbookPgPool: Pool | undefined;
}

export function createPool(connectionString: string, max = 20): Pool {
  return new Pool({
    connectionString,
    max,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
}

export function getPool(): Pool {
  if (!globalThis.__slotbookPgPool) {
    globalThis.__slotbookPgPool = createPool(requireDatabaseUrl());
  }
  return globalThis.__slotbookPgPool;
}

export function getDb(): DbClient {
  return drizzle(getPool(), { schema });
}

export async function closePool(): Promise<void> {
  if (globalThis.__slotbookPgPool) {
    await globalThis.__slotbookPgPool.end();
    globalThis.__slotbookPgPool = undefined;
  }
}
