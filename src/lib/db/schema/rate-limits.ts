import { index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const rateLimitBuckets = pgTable(
  'rate_limit_buckets',
  {
    key: text('key').primaryKey(),
    windowStart: timestamp('window_start', { withTimezone: true, mode: 'date' }).notNull(),
    currentCount: integer('current_count').default(0).notNull(),
    previousCount: integer('previous_count').default(0).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (table) => [index('idx_rate_limit_buckets_expires_at').on(table.expiresAt)],
);

export type RateLimitBucket = typeof rateLimitBuckets.$inferSelect;
export type NewRateLimitBucket = typeof rateLimitBuckets.$inferInsert;
