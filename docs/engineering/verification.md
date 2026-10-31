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

Resume Anywhere tests in `src/features/resume-anywhere/resume-anywhere.test.ts` cover deterministic transitions for `collect`, `review`, `decide`, `wait`, `handoff`, and `complete`, required field validation, and Zod input schemas without a database. API route tests in `src/app/api/runs/runs-api.test.ts` verify that unauthenticated and malformed requests fail closed. Integration tests in `src/platform/runs/repository.integration.test.ts` verify durable start, reload persistence, strict owner isolation (user B cannot read or mutate user A's run), optimistic concurrency conflict detection on stale revisions, idempotency replay, and immutable version binding against the development Neon database.

### Manual Verification
1. **Start a Run:** Navigate to a published journey version (e.g. `/journeys/vendor-onboarding/versions/1`) and click **Start Journey**. Ensure a new run is created at `/runs/[id]`.
2. **Persistence Across Reload & Device:** Complete the first collect step. Reload the browser or open the `/runs/[id]` URL in another private window authenticated with the same account. Verify the exact current step and collected values are preserved from PostgreSQL.
3. **Owner Isolation:** Attempt to access the same `/runs/[id]` URL from a different authenticated Clerk account. Verify access is blocked with a 403 Access Restricted state.
4. **Unauthenticated Safety Gate:** Log out and attempt to access `/runs` or `/runs/[id]`. Verify private runs cannot be viewed anonymously and an authentication prompt is displayed.
5. **Deterministic Wait Pause:** Proceed through the decision step to the wait step (`wait-registry`). Verify the run enters the `Paused` state with clear notice that Live Signal Inbox integration is required. Verify that manual bypass is rejected.

## CI

`.github/workflows/ci.yml` runs the same four commands on Ubuntu with Node.js 22 and `pnpm install --frozen-lockfile`. The workflow does not start a database service and does not require Docker on a developer machine. It has not been executed on GitHub until the branch is pushed.

The workflow token is limited to `contents: read`.
