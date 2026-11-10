import { foreignKey, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { eventTypes } from './event-types';
import { hosts } from './hosts';

export const BOOKING_SLOT_STATUSES = ['active', 'released'] as const;
export type BookingSlotStatus = (typeof BOOKING_SLOT_STATUSES)[number];

export const bookingSlots = pgTable(
  'booking_slots',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    hostId: uuid('host_id')
      .notNull()
      .references(() => hosts.id, { onDelete: 'cascade' }),
    eventTypeId: uuid('event_type_id')
      .notNull()
      .references(() => eventTypes.id, { onDelete: 'restrict' }),
    startTime: timestamp('start_time', { withTimezone: true, mode: 'date' }).notNull(),
    endTime: timestamp('end_time', { withTimezone: true, mode: 'date' }).notNull(),
    bufferStart: timestamp('buffer_start', { withTimezone: true, mode: 'date' }).notNull(),
    bufferEnd: timestamp('buffer_end', { withTimezone: true, mode: 'date' }).notNull(),
    capacitySnapshot: integer('capacity_snapshot').notNull(),
    status: text('status').$type<BookingSlotStatus>().default('active').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      name: 'fk_booking_slots_event_type_host',
      columns: [table.eventTypeId, table.hostId],
      foreignColumns: [eventTypes.id, eventTypes.hostId],
    }).onDelete('restrict'),
  ],
);

export type BookingSlot = typeof bookingSlots.$inferSelect;
export type NewBookingSlot = typeof bookingSlots.$inferInsert;
