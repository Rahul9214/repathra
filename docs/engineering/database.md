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

The module 001 migration is not rewritten. `pnpm db:migrate` applies only pending files through `DATABASE_URL_UNPOOLED`.

## Seed

`pnpm db:seed` upserts the product identity and the eight capabilities inside one transaction, using the pooled `DATABASE_URL`. It then ensures the two synthetic sandbox journeys exist. Run it after `pnpm db:migrate`. If the foundation tables are missing, the command reports that and does not claim the contract was stored. If the journey tables are missing, the contract seed can already have committed and the command exits with the journey migration message. Running it again does not insert another published version when version 1 is already stored.

## Migrations

`pnpm db:generate` writes SQL under `drizzle/migrations`. It does not connect. When `DATABASE_URL` is unset, Drizzle Kit is given a placeholder URL that the running application never uses.

`pnpm db:migrate` applies those files through `DATABASE_URL_UNPOOLED`, the direct Neon connection. A pooled `DATABASE_URL` is not used for migrations. The command exits before connecting when the direct URL is missing or invalid. When `DATABASE_URL_UNPOOLED` is unset and `DATABASE_URL` itself points at a non-pooler host, migrate uses that direct application URL.

## Probe, runs `select 1`, then reads `capability` and `platform_release`. The comparison is `interpretStoredContract`. An empty pair of results is `not_seeded`. Any other disagreement is `contract_mismatch`. SQLSTATE `42P01` is `schema_not_migrated`. Other failures are `unreachable`.

TLS comes from the connection string. Non-local hosts must set `sslmode` to `require`, `verify-ca`, or `verify-full`. The driver receives `verify-full` unchanged. `require` and `verify-ca` are opened with the driver's `require` mode, which encrypts the connection and does not apply the `verify-full` certificate check. Loopback may omit TLS. Hosts that contain `pooler`, and URLs with `pgbouncer=true`, disable prepared statements so transaction poolers can be used.

The client sets `application_name` to `repathra` and a 5 second statement timeout. Connections are closed after the probe or seed finishes.
