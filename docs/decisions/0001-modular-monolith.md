# ADR 0001: Modular Monolith with Dedicated Worker

## Status

Accepted (Phase 1A Foundation)

## Context

Slotbook requires strict transactional guarantees around concurrent slot holds, capacity enforcement, host-wide non-overlap invariants, atomic rescheduling, and reliable notification delivery without introducing distributed locking services (Redis is disallowed).

## Decision

1. Structure the application as a single Next.js 16 App Router modular monolith sharing domain and database layers with a separate Node.js background worker process.
2. Keep PostgreSQL 16+ as the sole source of truth for scheduling constraints (`booking_slots` GiST exclusion, row-level locks, idempotency, rate limits, sessions, and transactional outbox).
3. Enforce strict boundaries: `src/proxy.ts` remains stateless and DB-free, `src/lib/config/env.ts` and `src/lib/logger.ts` are marked `server-only`, and both dashboard and public UIs will share the same documented `/api/v1/*` JSON API.

## Consequences

- Zero split business logic between Server Actions and Route Handlers.
- Simple operational topology (Next.js app + background worker + PostgreSQL) via Docker Compose.
- Clear vertical module seams inside `src/lib/` enable independent testing and clean future extraction if ever needed.
