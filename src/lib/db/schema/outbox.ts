import { integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { bookings } from './bookings';

export const OUTBOX_STATUSES = ['pending', 'processing', 'sent', 'dead_letter'] as const;
export type OutboxStatus = (typeof OUTBOX_STATUSES)[number];

export const OUTBOX_EVENT_TYPES = [
  'booking.confirmed',
  'booking.cancelled',
  'booking.rescheduled',
] as const;
export type OutboxEventType = (typeof OUTBOX_EVENT_TYPES)[number];

export const outboxEvents = pgTable('outbox_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventType: text('event_type').$type<OutboxEventType>().notNull(),
  aggregateId: uuid('aggregate_id')
    .notNull()
    .references(() => bookings.id, { onDelete: 'cascade' }),
  dedupeKey: text('dedupe_key').notNull().unique(),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
  status: text('status').$type<OutboxStatus>().default('pending').notNull(),
  attempts: integer('attempts').default(0).notNull(),
  maxAttempts: integer('max_attempts').default(8).notNull(),
  lockedBy: text('locked_by'),
  leaseExpiresAt: timestamp('lease_expires_at', { withTimezone: true, mode: 'date' }),
  nextRetryAt: timestamp('next_retry_at', { withTimezone: true, mode: 'date' })
    .defaultNow()
    .notNull(),
  providerMessageId: text('provider_message_id'),
  lastError: text('last_error'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  processedAt: timestamp('processed_at', { withTimezone: true, mode: 'date' }),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
});

export type OutboxEvent = typeof outboxEvents.$inferSelect;
export type NewOutboxEvent = typeof outboxEvents.$inferInsert;
