# REPATHRA

Progress is not disposable.

REPATHRA 2.0 is an intelligent workflow recovery platform. Module 001 is the foundation: feature boundaries, shared contracts, configuration, a Drizzle schema for cloud PostgreSQL, a health endpoint, tests, and CI. The eight product capabilities are registered here and are not implemented yet.

## Capabilities

1. Journey Studio
2. Resume Anywhere
3. Live Signal Inbox
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
| `pnpm db:seed` | Upsert the product identity and eight capabilities |

`db:migrate` uses `DATABASE_URL_UNPOOLED` and exits before connecting when that direct URL is missing. It does not fall back to a pooled `DATABASE_URL`. `db:seed` uses `DATABASE_URL` and exits before connecting when that variable is missing.

## Documentation

Engineering notes live in [docs/engineering](docs/engineering/architecture.md).
