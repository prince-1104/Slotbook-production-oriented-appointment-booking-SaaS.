# Slotbook

Production-oriented appointment booking SaaS platform built with Next.js 16 App Router, strict TypeScript, Drizzle ORM, and PostgreSQL 16.

## Current Implementation Status

**Phase 1A (Project Foundation) — Completed:**

- Next.js 16 App Router (`src/` directory, React Server Components by default)
- Strict TypeScript (`strict`, `noImplicitAny`, `strictNullChecks`, `noUnusedLocals`, `noUnusedParameters`)
- ESLint 9 flat config + Prettier formatting rules
- Server-only lazy Zod environment configuration (`src/lib/config/env.ts`)
- Structured Pino JSON logger with request-ID context and secret/PII redaction (`src/lib/logger.ts`)
- Next.js 16 network proxy (`src/proxy.ts`) generating server-trusted `X-Request-Id` and security headers

**Phase 1B (Database Schema, Migrations, Seed, Healthcheck & Docker Stack) — Completed:**

- Full 12-table PostgreSQL 16 schema in Drizzle ORM (`src/lib/db/schema/*`): `hosts`, `host_sessions`, `event_types`, `weekly_availability`, `date_overrides`, `date_override_windows`, `booking_slots`, `bookings`, `idempotency_records`, `outbox_events`, `rate_limit_buckets`, `audit_logs`
- Engine-enforced SQL constraints & triggers (`src/lib/db/migrations/0001_constraints_and_triggers.sql`):
  - `btree_gist` exclusion constraint `excl_booking_slots_host_active_overlap` preventing overlapping active buffered slots per host across all event types
  - Partial unique index `uq_booking_slots_active_occurrence` on active `(event_type_id, start_time)`
  - Composite FK `fk_booking_slots_event_type_host` enforcing `booking_slots.host_id` ownership
  - Non-overlapping schedule window GiST exclusions on `weekly_availability` & `date_override_windows`
  - `enforce_booking_state_transition()` trigger + `CHECK` constraints on status & state fields
- Argon2id password hashing utility (`src/lib/auth/password.ts`)
- Standalone compiled migration & production-guarded idempotent demo seed runners (`scripts/migrate.ts`, `scripts/seed.ts`)
- Health endpoint `GET /api/v1/health` checking live PostgreSQL connectivity
- Multi-stage `Dockerfile` + `docker-compose.yml` (`db` → `migrate` → `seed` → `app`) & `docker-compose.prod.yml`

**Not Yet Implemented (Planned in Upcoming Phases):**

- Host authentication endpoints & dashboard UI (Phase 2)
- `@js-temporal/polyfill` availability engine, DST validation & event type CRUD (Phase 3)
- Transactional booking lifecycle (`hold`, `confirm`, `cancel`, `reschedule`), idempotency & concurrency test suite (Phase 4)
- Transactional outbox worker & Resend email delivery (Phase 5)
- Public booking & guest management UI + Playwright E2E + k6 load tests (Phases 6–7)

## Architecture

Slotbook follows a **modular monolith** pattern with strict separation between presentation, API handlers, domain logic, and infrastructure. See [docs/architecture/overview.md](docs/architecture/overview.md) and [docs/decisions/0001-modular-monolith.md](docs/decisions/0001-modular-monolith.md).

## Technology Stack

- **Framework:** Next.js 16 (App Router) & React 19
- **Language:** TypeScript 5 (strict mode)
- **Database & ORM:** PostgreSQL 16 & Drizzle ORM
- **Password Hashing:** Argon2id (`argon2`)
- **Styling:** Tailwind CSS v4
- **Validation & Logging:** Zod v4, Pino
- **Containers:** Docker & Docker Compose
- **Tooling:** ESLint 9 (`eslint-config-next`), Prettier, `tsx`, `tsc-alias`

## Prerequisites

- **Node.js:** `v22+` and **npm:** `v10+`
- **Docker & Docker Compose** (for containerized PostgreSQL 16 + full stack startup)

## Environment Configuration

Copy `.env.example` to `.env` and populate required secrets before starting:

```bash
cp .env.example .env
```

Never commit `.env` or `.env.local`. Generate strong values for `POSTGRES_PASSWORD`, `SESSION_SECRET` (32+ characters), and local `DEMO_HOST_EMAIL` / `DEMO_HOST_PASSWORD` (with `ALLOW_DEMO_SEED=true` only in local development; `scripts/seed.ts` refuses execution when `APP_ENV=production`).

## Docker Startup

Once `.env` is configured:

```bash
docker compose up --build
```

Startup order is enforced via health checks and service completion gates:
`db (healthy)` → `migrate (exits 0)` → `seed (exits 0)` → `app (healthy on :3000)`.

Verify health:

```bash
curl http://localhost:3000/api/v1/health
```

## Available Scripts

| Script                 | Description                                                    |
| ---------------------- | -------------------------------------------------------------- |
| `npm run dev`          | Start Next.js development server                               |
| `npm run build`        | Build Next.js production bundle                                |
| `npm run start`        | Start built production server                                  |
| `npm run lint`         | Run ESLint across the repository                               |
| `npm run typecheck`    | Generate Next.js route types and run `tsc --noEmit`            |
| `npm run format`       | Format codebase with Prettier                                  |
| `npm run format:check` | Check Prettier formatting without modifying files              |
| `npm run db:generate`  | Generate Drizzle SQL migrations                                |
| `npm run db:migrate`   | Run pending SQL migrations against `DATABASE_URL`              |
| `npm run db:seed`      | Run idempotent demo host/event-type seed (non-production only) |
