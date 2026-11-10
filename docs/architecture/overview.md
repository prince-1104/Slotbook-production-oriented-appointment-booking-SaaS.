# Slotbook Architecture Overview

## Core Paradigm

Slotbook is implemented as a **modular monolith** backed by **PostgreSQL 16+** as the single source of truth, paired with a dedicated background worker process (to be added in Phase 5) for asynchronous outbox email delivery and stale hold maintenance.

## Module Boundaries

- **Presentation (`src/app/(auth|dashboard|public)`, `src/components`)**: React Server Components and client views consuming the unified `/api/v1/*` JSON API. Never accesses the database or server-only secrets directly.
- **Network Proxy (`src/proxy.ts`)**: Next.js 16 boundary proxy generating a fresh `X-Request-Id` (`crypto.randomUUID()`) per request and setting baseline security headers. Performs no database or session queries.
- **API (`src/app/api/v1`)**: HTTP route handlers responsible for request validation (Zod), CSRF checks, PostgreSQL rate limiting, session resolution, domain invocation, and error-to-HTTP mapping.
- **Domain (`src/lib/domain`)**: Pure scheduling, availability, Temporal DST math, and transactional booking orchestration.
- **Infrastructure (`src/lib/config`, `src/lib/logger.ts`, `src/lib/db`, `src/lib/auth`, `src/lib/email`, `src/lib/rate-limit`)**: Server-only configuration, Pino structured logging with field redaction, Drizzle/PostgreSQL pool and schema, Argon2id hashing, and Resend adapter.
- **Tasks & Worker (`scripts/`, `src/worker`)**: Compiled standalone Node.js processes (`tsconfig.tasks.json`) executing migrations, guarded demo seeding, and background outbox/expiry loops.

## Current Phase Status

- **Phase 1A (Completed):** Project foundation, strict TypeScript, ESLint/Prettier, lazy server-only env validation, Pino logger, Next.js 16 `src/proxy.ts`, initial application shell.
- **Phase 1B (Completed):** Full 12-table Drizzle schema, custom PostgreSQL GiST exclusion & composite FK & state-transition trigger migrations, Argon2id password helper, migration/seed CLI runners, `/api/v1/health`, and multi-stage Docker Compose startup.
- **Not Yet Implemented:** Host authentication & session APIs, event type CRUD, Temporal DST availability engine, booking lifecycle & concurrency tests, outbox worker & Resend emails, public UI, E2E & k6 suites.
