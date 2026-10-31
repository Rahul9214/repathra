# REPATHRA

Progress is not disposable.

REPATHRA 2.0 is an intelligent workflow recovery platform. Module 001 is the foundation: feature boundaries, shared contracts, configuration, a Drizzle schema for cloud PostgreSQL, a health endpoint, tests, and CI. Module 002 delivers Journey Studio. Module 003 implements Resume Anywhere — persistent, cross-device execution of immutable published journeys with deterministic transitions, revision checks, owner isolation, and durable event logs. Module 004 implements Live Signal Inbox — real-time server-side HTTP observation, sanitized evidence capture, deterministic incident classification and correlation, durable operator lifecycle (open/acknowledged/resolved), and safe correlation with paused journey runs without auto-advancement. The other five capabilities stay registered.

## Capabilities

1. Journey Studio — editable drafts, validated steps, and immutable published versions
2. Resume Anywhere — durable run identity, deterministic step transitions, optimistic concurrency checks, and cross-device state resumption
3. Live Signal Inbox — HTTP observation boundary, sanitized telemetry, deterministic incident correlation, operator lifecycle, and workflow correlation
4. AI Incident Analyst
5. Recovery Plan Composer
6. Trust and Approval Desk
7. Recovery Runner
8. Evidence and Outcomes

## Local development

Use native Windows, Node.js 22, and pnpm. Docker and WSL are not required. The application uses a pooled Neon `DATABASE_URL`. Migrations use the direct `DATABASE_URL_UNPOOLED`.

```bash
pnpm install
pnpm dev
```

Copy `.env.example` to `.env.local` only when you have the Neon connection strings. Until `DATABASE_URL` is set, the app still starts and `GET /api/health` reports the database as `not_configured`.

## Scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Next.js development server |
| `pnpm typecheck` | TypeScript |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest |
| `pnpm build` | Production build |
| `pnpm db:generate` | Create a Drizzle migration from the schema |
| `pnpm db:migrate` | Apply migrations to the configured cloud database |
| `pnpm db:seed` | Upsert the product identity, eight capabilities, and two synthetic sandbox journeys |

`db:migrate` uses `DATABASE_URL_UNPOOLED` and exits before connecting when that direct URL is missing. It does not fall back to a pooled `DATABASE_URL`. `db:seed` uses `DATABASE_URL` and exits before connecting when that variable is missing.

## Documentation

Engineering notes live in [docs/engineering](docs/engineering/architecture.md).
