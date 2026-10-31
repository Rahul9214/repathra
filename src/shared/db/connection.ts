import postgres, { type Options, type Sql } from "postgres";

import { normalizeConnectionString } from "@/shared/config/env";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export function buildPostgresOptions(connectionString: string): Options<Record<string, never>> {
  return {
    max: 1,
    connect_timeout: 5,
    idle_timeout: 5,
    prepare: shouldPrepareStatements(connectionString),
    ssl: resolvePostgresSsl(connectionString),
    onnotice: () => undefined,
    connection: {
      application_name: "repathra",
      statement_timeout: 5000,
    },
  };
}

export function createPostgresClient(connectionString: string): Sql {
  const normalized = normalizeConnectionString(connectionString);
  return postgres(normalized, buildPostgresOptions(normalized));
}

export function resolvePostgresSsl(connectionString: string): "require" | "verify-full" | false {
  const url = new URL(connectionString);
  const sslMode = url.searchParams.get("sslmode")?.toLowerCase() ?? null;
  if (sslMode === "verify-full") return "verify-full";
  if (sslMode === "require" || sslMode === "verify-ca") return "require";
  if (LOCAL_HOSTS.has(url.hostname)) return false;
  return "require";
}

export function shouldPrepareStatements(connectionString: string): boolean {
  const url = new URL(connectionString);
  if (url.searchParams.get("pgbouncer")?.toLowerCase() === "true") return false;
  return !url.hostname.toLowerCase().includes("pooler");
}
