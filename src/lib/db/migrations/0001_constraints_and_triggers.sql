CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint

CREATE OR REPLACE FUNCTION "slotbook_local_time_range"(start_t time, end_t time)
RETURNS tsrange
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT tsrange(
    ('2000-01-01'::date + start_t)::timestamp,
    ('2000-01-01'::date + end_t)::timestamp,
    '[)'
  );
$$;--> statement-breakpoint

-- Event types business constraints
ALTER TABLE "event_types"
  ADD CONSTRAINT "chk_event_types_duration"
  CHECK ("duration_minutes" BETWEEN 15 AND 120);--> statement-breakpoint

ALTER TABLE "event_types"
  ADD CONSTRAINT "chk_event_types_capacity"
  CHECK ("capacity" >= 1);--> statement-breakpoint

ALTER TABLE "event_types"
  ADD CONSTRAINT "chk_event_types_buffer_before"
  CHECK ("buffer_before_minutes" BETWEEN 0 AND 30);--> statement-breakpoint

ALTER TABLE "event_types"
  ADD CONSTRAINT "chk_event_types_buffer_after"
  CHECK ("buffer_after_minutes" BETWEEN 0 AND 30);--> statement-breakpoint

ALTER TABLE "event_types"
  ADD CONSTRAINT "chk_event_types_min_notice"
  CHECK ("min_notice_minutes" >= 0);--> statement-breakpoint

ALTER TABLE "event_types"
  ADD CONSTRAINT "chk_event_types_max_advance"
  CHECK ("max_advance_days" BETWEEN 1 AND 365);--> statement-breakpoint

-- Weekly availability checks & non-overlapping time windows per host/day
ALTER TABLE "weekly_availability"
  ADD CONSTRAINT "chk_weekly_availability_day"
  CHECK ("day_of_week" BETWEEN 1 AND 7);--> statement-breakpoint

ALTER TABLE "weekly_availability"
  ADD CONSTRAINT "chk_weekly_availability_window"
  CHECK ("start_time" < "end_time");--> statement-breakpoint

ALTER TABLE "weekly_availability"
  ADD CONSTRAINT "excl_weekly_availability_overlap"
  EXCLUDE USING GIST (
    "host_id" WITH =,
    "day_of_week" WITH =,
    "slotbook_local_time_range"("start_time", "end_time") WITH &&
  );--> statement-breakpoint

-- Date override custom windows checks & non-overlapping enforcement
ALTER TABLE "date_override_windows"
  ADD CONSTRAINT "chk_date_override_windows_bounds"
  CHECK ("start_time" < "end_time");--> statement-breakpoint

ALTER TABLE "date_override_windows"
  ADD CONSTRAINT "excl_date_override_windows_overlap"
  EXCLUDE USING GIST (
    "date_override_id" WITH =,
    "slotbook_local_time_range"("start_time", "end_time") WITH &&
  );--> statement-breakpoint

-- Booking slots invariants & host-wide GiST exclusion (sole partial GiST index)
ALTER TABLE "booking_slots"
  ADD CONSTRAINT "chk_booking_slots_bounds"
  CHECK ("buffer_start" <= "start_time" AND "start_time" < "end_time" AND "end_time" <= "buffer_end");--> statement-breakpoint

ALTER TABLE "booking_slots"
  ADD CONSTRAINT "chk_booking_slots_capacity"
  CHECK ("capacity_snapshot" >= 1);--> statement-breakpoint

ALTER TABLE "booking_slots"
  ADD CONSTRAINT "chk_booking_slots_status"
  CHECK ("status" IN ('active', 'released'));--> statement-breakpoint

ALTER TABLE "booking_slots"
  ADD CONSTRAINT "excl_booking_slots_host_active_overlap"
  EXCLUDE USING GIST (
    "host_id" WITH =,
    tstzrange("buffer_start", "buffer_end", '[)') WITH &&
  ) WHERE ("status" = 'active');--> statement-breakpoint

CREATE UNIQUE INDEX "uq_booking_slots_active_occurrence"
  ON "booking_slots" ("event_type_id", "start_time")
  WHERE ("status" = 'active');--> statement-breakpoint

-- Bookings state & transition invariants
ALTER TABLE "bookings"
  ADD CONSTRAINT "chk_bookings_status"
  CHECK ("status" IN ('held', 'confirmed', 'cancelled', 'expired'));--> statement-breakpoint

ALTER TABLE "bookings"
  ADD CONSTRAINT "chk_bookings_held_state"
  CHECK (
    "status" <> 'held'
    OR (
      "held_until" IS NOT NULL
      AND "confirmed_at" IS NULL
      AND "cancelled_at" IS NULL
    )
  );--> statement-breakpoint

ALTER TABLE "bookings"
  ADD CONSTRAINT "chk_bookings_confirmed_state"
  CHECK (
    "status" <> 'confirmed'
    OR (
      "guest_name" IS NOT NULL
      AND "guest_email" IS NOT NULL
      AND "management_token_hash" IS NOT NULL
      AND "held_until" IS NULL
      AND "confirmed_at" IS NOT NULL
      AND "cancelled_at" IS NULL
    )
  );--> statement-breakpoint

ALTER TABLE "bookings"
  ADD CONSTRAINT "chk_bookings_cancelled_state"
  CHECK (
    "status" <> 'cancelled'
    OR (
      "cancelled_at" IS NOT NULL
      AND "cancelled_by" IN ('host', 'guest')
    )
  );--> statement-breakpoint

ALTER TABLE "bookings"
  ADD CONSTRAINT "chk_bookings_expired_state"
  CHECK (
    "status" <> 'expired'
    OR (
      "confirmed_at" IS NULL
      AND "cancelled_at" IS NULL
    )
  );--> statement-breakpoint

CREATE OR REPLACE FUNCTION "enforce_booking_state_transition"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'held' AND NEW.status IN ('confirmed', 'cancelled', 'expired') THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'confirmed' AND NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Invalid booking state transition: % -> %', OLD.status, NEW.status
    USING ERRCODE = '23514';
END;
$$;--> statement-breakpoint

CREATE TRIGGER "trg_bookings_state_transition"
  BEFORE UPDATE OF "status" ON "bookings"
  FOR EACH ROW
  EXECUTE FUNCTION "enforce_booking_state_transition"();--> statement-breakpoint

CREATE INDEX "idx_bookings_slot_status_held"
  ON "bookings" ("booking_slot_id", "status", "held_until")
  WHERE ("status" IN ('held', 'confirmed'));--> statement-breakpoint

-- Idempotency & Outbox status checks and claimable index
ALTER TABLE "idempotency_records"
  ADD CONSTRAINT "chk_idempotency_status"
  CHECK ("status" IN ('in_progress', 'completed', 'failed'));--> statement-breakpoint

ALTER TABLE "outbox_events"
  ADD CONSTRAINT "chk_outbox_status"
  CHECK ("status" IN ('pending', 'processing', 'sent', 'dead_letter'));--> statement-breakpoint

ALTER TABLE "outbox_events"
  ADD CONSTRAINT "chk_outbox_event_type"
  CHECK ("event_type" IN ('booking.confirmed', 'booking.cancelled', 'booking.rescheduled'));--> statement-breakpoint

CREATE INDEX "idx_outbox_claimable"
  ON "outbox_events" ("status", "next_retry_at", "lease_expires_at", "created_at")
  WHERE ("status" IN ('pending', 'processing'));
