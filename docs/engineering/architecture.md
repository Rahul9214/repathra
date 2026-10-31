# Architecture

REPATHRA 2.0 module 001 established the locked product contract. Module 002 added Journey Studio. Module 003 adds Resume Anywhere on that foundation.

## Layout

- `src/app` — Next.js App Router. The home page is the Journey Directory. `src/app/api/health/route.ts` remains the public readiness endpoint. Journey authoring routes live under `src/app/api/journeys` and `src/app/journeys`. Run execution routes live under `src/app/api/runs`, `src/app/runs`, and `src/app/runs/[id]`.
- `src/features/<capability>` — one folder per locked capability. Journey Studio holds the step schema, graph validation, sandbox templates, and publish rules. Resume Anywhere holds the run domain model, transition engine, validation schemas, and messages. The other six capabilities stay `registered`.
- `src/features/journey-studio` and `src/features/resume-anywhere` do not open database connections. `src/platform/journeys` persists drafts and published versions; `src/platform/runs` persists runs, revisions, and durable events.
- `src/shared/contracts` — product identity, the eight capability ids and names, health types, and the comparison used against rows stored in PostgreSQL.
- `src/shared/config` — server-side environment parsing, including Clerk key presence.
- `src/shared/validation` — Zod schemas for the capability contract and the health report.
- `src/shared/db` — Drizzle schema, cloud PostgreSQL client options, and the live probe.
- `src/platform` — composition of contracts, configuration, authentication, and the database.
- `scripts/seed-contract.ts` — CLI entry for the product contract and the two synthetic sandbox journeys. It is not imported by the Next.js app.
- `src/proxy.ts` — passes requests through when Clerk is not configured. When both Clerk keys are present, it runs Clerk's session middleware. Authorization for edits still happens inside the server action or route.

## Capability status

`registered` remains the only capability status. The health contract from module 001 compares capability ids and names, and the health schema still requires `registered`. Journey Studio and Resume Anywhere behaviors are implemented beside that row. Changing the status would make the live health check fail the locked contract.

## Journey Studio

A journey is a definition plus one editable draft and zero or more published versions.

Step types are restricted to `collect`, `review`, `decide`, `wait`, `handoff`, and `complete`. Server-side validation rejects unknown shapes, missing targets, self-transitions, cycles, unreachable steps, and routes that cannot end at a complete step. The entry step is the first step.

Publishing copies the validated draft into `journey_version`, stores a SHA-256 content hash, and increments the version number. The application has no update or delete path for that table. The migration also installs `BEFORE UPDATE` and `BEFORE DELETE` triggers that reject changes. Publishing the same hash as the latest version is refused. A stale draft revision is refused.

`vendor-onboarding` and `service-intake` are synthetic sandbox journeys. Their definitions carry the sandbox notice, and seed inserts version 1 only when that version is absent. Seed does not rewrite a published version.

Public journey previews, route diagrams, and version history can be read without authentication. Draft saves, new operator journeys, and publishing require an explicitly authorized operator session. If either Clerk key is missing, mutating actions fail closed with `auth_not_configured`. A configured Clerk instance with no signed-in user returns `unauthenticated` with an interactive sign-in action and preview states. Signed-in accounts without operator authorization are denied with `unauthorized`. Server-side operator permission is verified through operator/admin roles, organization permissions, `OPERATOR_USER_IDS` allowlist, or explicit operator claims. `GET /api/health` stays public.

## Resume Anywhere

Resume Anywhere enables an authenticated user to start an execution run against an immutable published journey version, complete supported steps, leave, and continue from the exact persisted step on any session, tab, or device.

### Immutable Version Binding
- A run is instantiated strictly against a published `journey_version` row, recording `journey_version_id`, `version_number`, and `content_hash`.
- Runs are never started against drafts.
- Publishing subsequent versions of a journey never alters or rebinds existing runs; each run executes against its frozen snapshot.

### Deterministic Server-Side State Machine
Step transitions execute via a pure deterministic engine against the frozen `JourneyDocument`:
- `collect`: Validates that required fields are provided with non-empty trimmed strings (max 2000 chars), storing accepted values into `collected_values`.
- `review`: Requires explicit user acknowledgment (`acknowledged === true`) before advancing.
- `decide`: Requires selecting a valid outcome id matching one of the step's defined outcomes.
- `wait`: Pauses execution with `status = "paused"` awaiting a future signal from Live Signal Inbox. Attempted manual step advancement is strictly rejected with `step_paused_waiting_for_signal`.
- `handoff`: Pauses execution with `status = "paused"` awaiting authorized handoff clearance. Attempted manual step advancement is strictly rejected with `step_paused_waiting_for_handoff`.
- `complete`: Terminal state with `status = "completed"`. Records `completed_outcome` and `completed_at`. Rejects any further transition attempts with `run_already_completed`.

### Authentication and Ownership
- Run ownership is authenticated server-side using Clerk `auth().userId`.
- Ordinary authenticated users can own and execute runs without receiving Journey Studio operator privileges.
- Every read (`GET /api/runs`, `GET /api/runs/[id]`) and mutation (`POST /api/runs`, `POST /api/runs/[id]/step`) enforces strict owner isolation. Users cannot inspect or mutate runs owned by another account.
- Anonymous or unconfigured authentication fails closed (`401 unauthenticated` or `503 auth_not_configured`).

### Concurrency and Idempotency
- All state modifications run inside PostgreSQL transactions with optimistic revision checks (`revision = expectedRevision`). Conflicting concurrent requests or stale browser tabs receive HTTP 409 `revision_conflict`.
- Every transition appends an immutable entry to `journey_run_event`.
- Idempotency keys prevent double submissions from double clicks or network retries by replaying the existing successful result.


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

## Visual system

The studio uses the Analog Future and Transit Editorial system: warm paper, ink, a brass rule, and a night masthead. Fraunces carries the headlines, Outfit carries the interface, and IBM Plex Mono carries route numbers, step ids, and content hashes. Sandbox journeys are labeled `Synthetic sandbox` on the board.

## Left untouched

`repathra/` is a nested checkout with its own `.git`. It is excluded from TypeScript and ESLint and was not deleted. `drizzle/migrations/0000_foundation.sql` is unchanged.
