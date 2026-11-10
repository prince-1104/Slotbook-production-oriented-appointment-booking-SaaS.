import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { hosts } from './hosts';

export const eventTypes = pgTable(
  'event_types',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    hostId: uuid('host_id')
      .notNull()
      .references(() => hosts.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    durationMinutes: integer('duration_minutes').notNull(),
    capacity: integer('capacity').default(1).notNull(),
    bufferBeforeMinutes: integer('buffer_before_minutes').default(0).notNull(),
    bufferAfterMinutes: integer('buffer_after_minutes').default(0).notNull(),
    minNoticeMinutes: integer('min_notice_minutes').default(60).notNull(),
    maxAdvanceDays: integer('max_advance_days').default(30).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_event_types_host_slug').on(table.hostId, table.slug),
    unique('uq_event_types_id_host').on(table.id, table.hostId),
  ],
);

export type EventType = typeof eventTypes.$inferSelect;
export type NewEventType = typeof eventTypes.$inferInsert;
