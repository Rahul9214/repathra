import {
  isPooledConnectionString,
  loadConfig,
  normalizeConnectionString,
  readDatabaseUrl,
  type ConfigEnv,
} from "@/shared/config/env";

/** Used only by drizzle-kit generate when no database is configured. The app never connects with it. */
export const UNCONFIGURED_DATABASE_URL = "postgresql://unconfigured@127.0.0.1:5432/unconfigured";

const CONNECTING_COMMANDS = new Set(["migrate", "push", "studio", "pull"]);

export type DrizzleCredentialSource = "unpooled" | "application" | "unconfigured-placeholder";

export function drizzleCommandNeedsDatabase(argv: readonly string[]): boolean {
  return argv.some((arg) => CONNECTING_COMMANDS.has(arg));
}

export function resolveMigrationConnection(env: ConfigEnv):
  | { ok: true; connectionString: string; source: "unpooled" | "application" }
  | { ok: false; message: string } {
  const unpooled = readDatabaseUrl(env.DATABASE_URL_UNPOOLED, "DATABASE_URL_UNPOOLED");
  if (unpooled.state === "invalid") {
    return { ok: false, message: unpooled.issues.join(" ") };
  }
  if (unpooled.state === "configured") {
    return {
      ok: true,
      connectionString: normalizeConnectionString(unpooled.connectionString),
      source: "unpooled",
    };
  }

  const application = readDatabaseUrl(env.DATABASE_URL, "DATABASE_URL");
  if (application.state === "invalid") {
    return { ok: false, message: application.issues.join(" ") };
  }
  if (application.state === "configured") {
    if (isPooledConnectionString(application.connectionString)) {
      return {
        ok: false,
        message:
          "DATABASE_URL_UNPOOLED is not set. Migrations do not use the pooled DATABASE_URL. No database was contacted.",
      };
    }
    return {
      ok: true,
      connectionString: normalizeConnectionString(application.connectionString),
      source: "application",
    };
  }

  return {
    ok: false,
    message:
      "DATABASE_URL_UNPOOLED is not set. Add the Neon direct connection string to .env.local. No database was contacted.",
  };
}

export function resolveDrizzleCredentials(input: {
  argv: readonly string[];
  env: ConfigEnv;
}): { url: string; source: DrizzleCredentialSource } {
  const loaded = loadConfig(input.env);
  if (!loaded.ok) {
    throw new Error(loaded.issues.join(" "));
  }

  const migration = resolveMigrationConnection(input.env);
  if (migration.ok) {
    return { url: migration.connectionString, source: migration.source };
  }

  if (drizzleCommandNeedsDatabase(input.argv)) {
    throw new Error(migration.message);
  }

  return {
    url: UNCONFIGURED_DATABASE_URL,
    source: "unconfigured-placeholder",
  };
}
