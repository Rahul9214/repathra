# Database

PostgreSQL is expected to be a cloud instance. This module does not add Docker Compose, a local Postgres installer, or a WSL setup.

## Schema

Drizzle defines two foundation tables:

- `platform_release` stores the product name, version `2.0.0`, and the tagline for the row id `current`.
- `capability` stores the eight locked capabilities. The id column is a PostgreSQL enum of those ids. `status` is an enum whose only value in this module is `registered`. `sort_order` matches the locked order.

No journey, signal, incident, approval, or evidence tables were created in module 001. Module 002 adds three tables in `0001_windy_marvex.sql`:

- `journey_definition` stores the slug, origin (`operator` or `sandbox`), optional template key, and the sandbox notice. A check constraint requires the notice and template key for sandbox rows and forbids them for operator rows.
- `journey_draft` stores the single editable draft for a journey, including its revision and step document.
- `journey_version` stores immutable published snapshots and a SHA-256 content hash. `BEFORE UPDATE` and `BEFORE DELETE` triggers reject mutation.

Module 003 adds two tables in `0002_skinny_firedrake.sql`:

- `journey_run` stores persistent execution instances for an authenticated user. It holds the run id (UUID), foreign keys to `journey_definition` and `journey_version`, the immutable `version_number` and `content_hash`, the Clerk `owner_id`, `current_step_id`, status (`active`, `paused`, `completed`), revision (optimistic concurrency counter, >= 1), collected values JSONB, completed step IDs JSONB, terminal outcome, and timestamps.
- `journey_run_event` stores the durable audit log of state transitions for each run. It records run id (cascading foreign key), sequence number, event type (`run_started`, `step_transitioned`, `run_paused`, `run_completed`), from and to step ids, action payload JSONB, idempotency key (unique per run), actor id, and timestamp.

Module 004 adds three tables and four enums in `0003_medical_the_fury.sql`:

- `incident` stores correlated, durable failure incidents. It holds the incident id (UUID), deterministic SHA-256 fingerprint, title, source, operation, optional `signal_key`, severity (`critical`, `high`, `medium`, `low`), status (`open`, `acknowledged`, `resolved`), occurrence counter (>= 1), first/last seen timestamps, and operator resolution audit fields (`acknowledged_at`, `acknowledged_by`, `resolved_at`, `resolved_by`, `resolution_note`).
- `signal` stores immutable evidence captured from the HTTP observation boundary or authenticated webhooks. It records signal id (UUID), foreign key to `incident.id` (cascading), provenance (`observed_http`, `authenticated_webhook`, `diagnostic`), source, operation, optional `signal_key`, optional foreign key to `journey_run.id` (ON DELETE SET NULL), HTTP method, sanitized URL, response status, duration in ms (>= 0), failure category (`http_4xx`, `http_5xx`, `timeout`, `network_error`, `tls_error`, `payload_error`), correlation ID, unique idempotency key, sanitized telemetry JSONB (redacted headers), metadata JSONB, and occurrence timestamp.
- `incident_event` stores the immutable audit trail for each incident: foreign key to `incident.id` (cascading), event type (`incident_opened`, `signal_attached`, `incident_acknowledged`, `incident_resolved`), operator/actor ID, audit notes, and creation timestamp.

The module 001, 002, and 003 migrations are not rewritten. `pnpm db:migrate` applies only pending files through `DATABASE_URL_UNPOOLED`.

## Seed

`pnpm db:seed` upserts the product identity and the eight capabilities inside one transaction, using the pooled `DATABASE_URL`. It then ensures the two synthetic sandbox journeys exist. Run it after `pnpm db:migrate`. If the foundation tables are missing, the command reports that and does not claim the contract was stored. If the journey tables are missing, the contract seed can already have committed and the command exits with the journey migration message. Running it again does not insert another published version when version 1 is already stored.

## Migrations

`pnpm db:generate` writes SQL under `drizzle/migrations`. It does not connect. When `DATABASE_URL` is unset, Drizzle Kit is given a placeholder URL that the running application never uses.

`pnpm db:migrate` applies those files through `DATABASE_URL_UNPOOLED`, the direct Neon connection. A pooled `DATABASE_URL` is not used for migrations. The command exits before connecting when the direct URL is missing or invalid. When `DATABASE_URL_UNPOOLED` is unset and `DATABASE_URL` itself points at a non-pooler host, migrate uses that direct application URL.

## Probe, runs `select 1`, then reads `capability` and `platform_release`. The comparison is `interpretStoredContract`. An empty pair of results is `not_seeded`. Any other disagreement is `contract_mismatch`. SQLSTATE `42P01` is `schema_not_migrated`. Other failures are `unreachable`.

TLS comes from the connection string. Non-local hosts must set `sslmode` to `require`, `verify-ca`, or `verify-full`. The driver receives `verify-full` unchanged. `require` and `verify-ca` are opened with the driver's `require` mode, which encrypts the connection and does not apply the `verify-full` certificate check. Loopback may omit TLS. Hosts that contain `pooler`, and URLs with `pgbouncer=true`, disable prepared statements so transaction poolers can be used.

The client sets `application_name` to `repathra` and a 5 second statement timeout. Connections are closed after the probe or seed finishes.
