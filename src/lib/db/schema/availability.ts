import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { hosts } from './hosts';

export const weeklyAvailability = pgTable(
  'weekly_availability',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    hostId: uuid('host_id')
      .notNull()
      .references(() => hosts.id, { onDelete: 'cascade' }),
    // ISO weekday: 1 = Monday .. 7 = Sunday (matches Temporal.PlainDate.dayOfWeek)
    dayOfWeek: integer('day_of_week').notNull(),
    startTime: time('start_time', { withTimezone: false }).notNull(),
    endTime: time('end_time', { withTimezone: false }).notNull(),
  },
  (table) => [index('idx_weekly_availability_host_day').on(table.hostId, table.dayOfWeek)],
);

export const dateOverrides = pgTable(
  'date_overrides',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    hostId: uuid('host_id')
      .notNull()
      .references(() => hosts.id, { onDelete: 'cascade' }),
    overrideDate: date('override_date', { mode: 'string' }).notNull(),
    isDayOff: boolean('is_day_off').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('uq_date_overrides_host_date').on(table.hostId, table.overrideDate)],
);

export const dateOverrideWindows = pgTable(
  'date_override_windows',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    dateOverrideId: uuid('date_override_id')
      .notNull()
      .references(() => dateOverrides.id, { onDelete: 'cascade' }),
    startTime: time('start_time', { withTimezone: false }).notNull(),
    endTime: time('end_time', { withTimezone: false }).notNull(),
  },
  (table) => [index('idx_date_override_windows_parent').on(table.dateOverrideId)],
);

export type WeeklyAvailability = typeof weeklyAvailability.$inferSelect;
export type NewWeeklyAvailability = typeof weeklyAvailability.$inferInsert;
export type DateOverride = typeof dateOverrides.$inferSelect;
export type NewDateOverride = typeof dateOverrides.$inferInsert;
export type DateOverrideWindow = typeof dateOverrideWindows.$inferSelect;
export type NewDateOverrideWindow = typeof dateOverrideWindows.$inferInsert;
