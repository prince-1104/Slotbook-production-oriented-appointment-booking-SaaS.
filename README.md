# Slotbook

Production-oriented appointment booking SaaS platform built with Next.js 16 App Router, strict TypeScript, and PostgreSQL.

## Current Implementation Status

**Phase 1A (Project Foundation) — Completed:**

- Next.js 16 App Router (`src/` directory, React Server Components by default)
- Strict TypeScript (`strict`, `noImplicitAny`, `strictNullChecks`, `noUnusedLocals`, `noUnusedParameters`)
- ESLint 9 flat config + Prettier formatting rules
- Server-only lazy Zod environment configuration (`src/lib/config/env.ts`)
- Structured Pino JSON logger with request-ID context and secret/PII redaction (`src/lib/logger.ts`)
- Next.js 16 network proxy (`src/proxy.ts`) generating server-trusted `X-Request-Id` and security headers
- Clean initial application shell (`src/app/layout.tsx`, `src/app/page.tsx`, `src/components/shared/app-shell.tsx`)

**Not Yet Implemented (Planned in Upcoming Phases):**

- PostgreSQL database schemas, GiST exclusion constraints, and Drizzle migrations
- Docker Compose deployment stack (`db`, `migrate`, `seed`, `app`, `worker`)
- Host authentication (Argon2id + revocable PostgreSQL sessions)
- Event type CRUD, weekly multi-window schedules, and date overrides
- `@js-temporal/polyfill` availability engine & DST handling
- Transactional booking lifecycle (`held → confirmed → cancelled` / `expired`), idempotency, and atomic rescheduling
- Resend transactional outbox & background worker
- Unit, real-PostgreSQL concurrency integration, Playwright E2E, and k6 load test suites

## Architecture

Slotbook follows a **modular monolith** pattern with strict separation between presentation, API handlers, domain logic, and infrastructure. See [docs/architecture/overview.md](docs/architecture/overview.md) and [docs/decisions/0001-modular-monolith.md](docs/decisions/0001-modular-monolith.md).

```
src/
├── proxy.ts                  # Next.js 16 proxy (X-Request-Id + security headers; no DB/auth)
├── app/
│   ├── layout.tsx            # Root metadata & AppShell wrapper
│   ├── page.tsx              # Minimal Phase 1A entry page
│   └── globals.css           # Tailwind CSS v4 base configuration
├── components/
│   └── shared/app-shell.tsx  # Reusable page chrome
└── lib/
    ├── config/env.ts         # Server-only lazy Zod environment validation
    └── logger.ts             # Server-only Pino structured JSON logger with redaction
docs/
├── architecture/overview.md
└── decisions/0001-modular-monolith.md
```

## Technology Stack (Phase 1A)

- **Framework:** Next.js 16 (App Router) & React 19
- **Language:** TypeScript 5 (strict mode)
- **Styling:** Tailwind CSS v4
- **Validation:** Zod v4
- **Logging:** Pino
- **Tooling:** ESLint 9 (`eslint-config-next`), Prettier

## Prerequisites

- **Node.js:** `v22+`
- **npm:** `v10+`

## Environment Configuration

Copy `.env.example` to `.env` before customizing runtime values:

```bash
cp .env.example .env
```

- `APP_ENV`: `development` | `test` | `production` (defaults to `development`)
- `APP_URL`: Canonical public application URL (required when `APP_ENV=production`)
- `DATABASE_URL`: Optional in Phase 1A; required once database integration is implemented
- `SESSION_SECRET`: Optional in Phase 1A; required (32+ chars) once authentication is implemented
- `RESEND_API_KEY`: Optional in Phase 1A; required once email delivery is implemented
- `EMAIL_FROM`: Sender address for outgoing notifications
- `LOG_LEVEL`: Optional Pino log level override

Environment validation runs lazily on the server (`src/lib/config/env.ts`) and uses `server-only` so server credentials can never be imported into browser bundles.

## Development Startup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Available Scripts

| Script                 | Description                                         |
| ---------------------- | --------------------------------------------------- |
| `npm run dev`          | Start Next.js development server                    |
| `npm run build`        | Build Next.js production bundle                     |
| `npm run start`        | Start built production server                       |
| `npm run lint`         | Run ESLint across the repository                    |
| `npm run typecheck`    | Generate Next.js route types and run `tsc --noEmit` |
| `npm run format`       | Format codebase with Prettier                       |
| `npm run format:check` | Check Prettier formatting without modifying files   |
