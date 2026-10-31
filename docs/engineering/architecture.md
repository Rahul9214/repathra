# Architecture

REPATHRA 2.0 module 001 establishes boundaries for the locked product contract. It does not implement the capabilities themselves.

## Layout

- `src/app` — Next.js App Router. The starter page remains. `src/app/api/health/route.ts` is the readiness endpoint.
- `src/features/<capability>` — one folder per locked capability. Each folder exports a contract with status `registered`.
- `src/shared/contracts` — product identity, the eight capability ids and names, health types, and the comparison used against rows stored in PostgreSQL.
- `src/shared/config` — server-side environment parsing.
- `src/shared/validation` — Zod schemas for the capability contract and the health report.
- `src/shared/db` — Drizzle schema, cloud PostgreSQL client options, and the live probe.
- `src/platform` — composition of contracts, configuration, and the database. Health reports and seeding live here.
- `scripts/seed-contract.ts` — CLI entry for seeding. It is not imported by the Next.js app.

Feature modules do not import the database. The database schema imports capability ids, not feature behavior.

## Capability status

`registered` means the capability is part of the locked contract and has no workflow implementation in this module. Later modules add behavior inside the matching feature folder and extend the status enum when they do.

## Health

`GET /api/health` is unauthenticated readiness. It always lists the eight capabilities from the TypeScript registry. The database section is a separate check:

| Database status | Meaning | HTTP |
| --- | --- | --- |
| `not_configured` | `DATABASE_URL` is unset. No connection was attempted. | 503 |
| `skipped` | Configuration is invalid, so the URL was not used. | 503 |
| `unreachable` | A connection or query failed. | 503 |
| `schema_not_migrated` | The server answered, and a foundation table is missing. | 503 |
| `not_seeded` | The tables exist and the contract rows are absent. | 503 |
| `contract_mismatch` | Stored rows differ from the locked contract. | 503 |
| `ok` | `select 1` succeeded and the stored identity matches the locked contract. | 200 |

The response never includes the connection string, host, username, or driver error text. Overall status is `ok` only when the database status is `ok`.

The route calls `connection()` from `next/server` before reading the environment, so the check runs at request time under Cache Components. Do not export a segment `runtime` from this route. Next.js rejects that option while `cacheComponents` is enabled. The Node.js `postgres` driver stays external through `serverExternalPackages`, and the production build marks `/api/health` as dynamic.

## Left untouched

`repathra/` is a nested checkout with its own `.git`. It is excluded from TypeScript and ESLint and was not deleted. The starter page body in `src/app/page.tsx` is unchanged. The document title and description now come from the product contract.
