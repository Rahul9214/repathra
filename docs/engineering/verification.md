# Verification

Run these from the repository root on native Windows:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

`pnpm test` does not provision PostgreSQL. The live probe test is skipped unless `DATABASE_URL` is set in the environment. A skipped probe is not a successful connection.

After both Neon URLs are in `.env.local`:

```bash
pnpm db:migrate
pnpm db:seed
```

`db:migrate` reads `DATABASE_URL_UNPOOLED`. `db:seed` and `/api/health` read `DATABASE_URL`.

Then request `GET /api/health`. HTTP 200 and `"checks": { "database": { "status": "ok" } }` means the probe connected and the stored rows matched the locked contract. Any other database status means that check did not pass.

`pnpm db:seed` also records `vendor-onboarding` and `service-intake` when the journey tables exist. A second run does not publish another version.

Journey Studio tests cover validation, publishing immutability, version numbers, unauthorized writes, and the sandbox templates without a database. `src/platform/journeys/repository.integration.test.ts` reads `DATABASE_URL` from the environment or from `.env.local`, because Vitest runs with `NODE_ENV=test` and Next does not load `.env.local` in that mode. The test checks the stored sandbox versions and rolls back an attempted update of `journey_version`. It is skipped when no development URL is available.

## CI

`.github/workflows/ci.yml` runs the same four commands on Ubuntu with Node.js 22 and `pnpm install --frozen-lockfile`. The workflow does not start a database service and does not require Docker on a developer machine. It has not been executed on GitHub until the branch is pushed.

The workflow token is limited to `contents: read`.
