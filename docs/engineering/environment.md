# Environment and configuration

Server configuration is read through `loadConfig` in `src/shared/config/env.ts`. Next.js loads `.env`, `.env.local`, and the environment-specific files from the project root. Do not put env files in `src/`.

## Variables

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Required for readiness and seed | Pooled Neon URL. Server-only. `postgresql://` or `postgres://`. Non-local hosts must require TLS. |
| `DATABASE_URL_UNPOOLED` | Required for migrations when `DATABASE_URL` is pooled | Direct Neon URL. Server-only. Migrations do not use the pooler. |
| `NODE_ENV` | Set by Next.js and the test runner | `development`, `test`, or `production`. An unknown value is a configuration error. |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Required to edit or publish | Clerk publishable key. Safe to expose to the browser. Must start with `pk_test_` or `pk_live_`. |
| `CLERK_SECRET_KEY` | Required to edit or publish | Clerk secret key. Server-only. Must start with `sk_test_` or `sk_live_`. |

There is no `NEXT_PUBLIC_` database setting. The browser bundle must not receive the connection string.

`.env.example` documents the variable and is safe to commit because the real URL stays commented out. `.gitignore` ignores `.env*` and then un-ignores `.env.example`.

## Validation rules

`loadConfig` returns issues without copying the connection string into those messages.

A remote URL is rejected when the scheme is wrong, the host, database name, username, or password is missing, or `sslmode` is not `require`, `verify-ca`, or `verify-full`. A loopback host (`localhost`, `127.0.0.1`, `::1`) may omit TLS.

Invalid configuration does not crash the Next.js process. The existing pages still render. Readiness fails closed: `/api/health` returns 503 and does not open a connection.

Journey Studio also fails closed when either Clerk key is missing or unusable. The home page still renders published journeys, and edit or publish actions return `auth_not_configured`. The missing key value is never copied into the message. Clerk keyless provisioning is disabled, so a missing key is not replaced with a generated credential.

## Drizzle Kit

`drizzle.config.ts` and `scripts/seed-contract.ts` call `loadProjectEnv`, which loads the Next.js env files from an absolute project directory and rejects UTF-16 files before reading them into the process. The loader does not print file contents. `generate` can run without a database. `migrate`, `push`, `studio`, and `pull` use `DATABASE_URL_UNPOOLED` and refuse to start when that direct URL is missing. `channel_binding` is removed before a string is handed to a driver, and the userinfo is left unchanged.

## Health endpoint

`GET /api/health` is public. It returns the product identity, the eight registered capabilities, and the two checks described in the architecture note. It sends `Cache-Control: no-store`. It does not read query parameters and it does not reflect request input into the body.

Driver failures are logged as a SQLSTATE or error name only. The response body does not include the driver message.
