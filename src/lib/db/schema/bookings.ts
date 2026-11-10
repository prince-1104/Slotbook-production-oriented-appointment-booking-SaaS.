import { type AnyPgColumn, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { bookingSlots } from './booking-slots';

export const BOOKING_STATUSES = ['held', 'confirmed', 'cancelled', 'expired'] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const CANCELLATION_ACTORS = ['host', 'guest'] as const;
export type CancellationActor = (typeof CANCELLATION_ACTORS)[number];

export const bookings = pgTable('bookings', {
  id: uuid('id').defaultRandom().primaryKey(),
  bookingSlotId: uuid('booking_slot_id')
    .notNull()
    .references(() => bookingSlots.id, { onDelete: 'restrict' }),
  rescheduledFromId: uuid('rescheduled_from_id').references((): AnyPgColumn => bookings.id, {
    onDelete: 'set null',
  }),
  guestName: text('guest_name'),
  guestEmail: text('guest_email'),
  status: text('status').$type<BookingStatus>().default('held').notNull(),
  heldUntil: timestamp('held_until', { withTimezone: true, mode: 'date' }),
  managementTokenHash: text('management_token_hash').unique(),
  cancelledBy: text('cancelled_by').$type<CancellationActor>(),
  cancelReason: text('cancel_reason'),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true, mode: 'date' }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
});

export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;
