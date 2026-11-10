# Slotbook Architecture Overview

## Core Paradigm

Slotbook is implemented as a **modular monolith** backed by **PostgreSQL 16+** as the single source of truth, paired with a dedicated background worker process for asynchronous outbox email delivery and stale hold maintenance.

## Module Boundaries

- **Presentation (`src/app/(auth|dashboard|public)`, `src/components`)**: React Server Components and client views consuming the unified `/api/v1/*` JSON API. Never accesses the database or server-only secrets directly.
- **Network Proxy (`src/proxy.ts`)**: Next.js 16 boundary proxy generating a fresh `X-Request-Id` (`crypto.randomUUID()`) per request and setting baseline security headers. Performs no database or session queries.
- **API (`src/app/api/v1`)**: HTTP route handlers responsible for request validation (Zod), CSRF checks, PostgreSQL rate limiting, session resolution, domain invocation, and error-to-HTTP mapping.
- **Domain (`src/lib/domain`)**: Pure scheduling, availability, Temporal DST math, and transactional booking orchestration.
- **Infrastructure (`src/lib/config`, `src/lib/logger.ts`, `src/lib/db`, `src/lib/auth`, `src/lib/email`, `src/lib/rate-limit`)**: Server-only configuration, Pino structured logging with field redaction, Drizzle/PostgreSQL client, Argon2id, and Resend adapter.
- **Worker (`src/worker`)**: Separate Node.js process executing non-overlapping outbox delivery and hold-expiry sweeps.

## Current Phase Status

- **Phase 1A (Current):** Project foundation, strict TypeScript, ESLint/Prettier, lazy server-only env validation, Pino logger, Next.js 16 `src/proxy.ts`, initial application shell.
- **Not Yet Implemented:** Database schemas & migrations, Docker Compose stack, host authentication, event type management, Temporal DST availability engine, booking lifecycle, outbox worker, automated test suites.
