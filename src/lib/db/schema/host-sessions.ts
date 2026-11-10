import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { hosts } from './hosts';

export const hostSessions = pgTable(
  'host_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    hostId: uuid('host_id')
      .notNull()
      .references(() => hosts.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'date' }),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('idx_host_sessions_host_active').on(table.hostId, table.expiresAt)],
);

export type HostSession = typeof hostSessions.$inferSelect;
export type NewHostSession = typeof hostSessions.$inferInsert;
