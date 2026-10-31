export type ConfigEnv = {
  NODE_ENV?: string;
  DATABASE_URL?: string;
  DATABASE_URL_UNPOOLED?: string;
};

export type NodeEnvironment = "development" | "test" | "production";

export type DatabaseSslMode = "disable" | "require" | "verify-ca" | "verify-full";

export type DatabaseConfig =
  | { configured: false }
  | {
      configured: true;
      connectionString: string;
      sslMode: DatabaseSslMode;
    };

export type AppConfig = {
  nodeEnv: NodeEnvironment;
  database: DatabaseConfig;
};

export type ConfigLoadResult =
  | { ok: true; config: AppConfig }
  | { ok: false; issues: string[] };

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const REMOTE_TLS_MODES = new Set(["require", "verify-ca", "verify-full"]);

export function loadConfig(env: ConfigEnv): ConfigLoadResult {
  const issues: string[] = [];
  const nodeEnv = readNodeEnv(env.NODE_ENV, issues);
  const database = readDatabaseUrl(env.DATABASE_URL, "DATABASE_URL");
  if (database.state === "invalid") {
    issues.push(...database.issues);
  }

  if (issues.length > 0 || !nodeEnv) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    config: {
      nodeEnv,
      database:
        database.state === "configured"
          ? {
              configured: true,
              connectionString: database.connectionString,
              sslMode: database.sslMode,
            }
          : { configured: false },
    },
  };
}

function readNodeEnv(value: string | undefined, issues: string[]): NodeEnvironment | null {
  if (value === undefined || value === "") {
    return "development";
  }
  if (value === "development" || value === "test" || value === "production") {
    return value;
  }
  issues.push("NODE_ENV must be development, test, or production.");
  return null;
}

export type DatabaseUrlRead =
  | { state: "missing" }
  | { state: "invalid"; issues: string[] }
  | { state: "configured"; connectionString: string; sslMode: DatabaseSslMode };

export function readDatabaseUrl(value: string | undefined, variableName: string): DatabaseUrlRead {
  if (value === undefined || value.trim() === "") {
    return { state: "missing" };
  }

  const issues: string[] = [];
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { state: "invalid", issues: [`${variableName} is not a valid PostgreSQL connection string.`] };
  }

  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    issues.push(`${variableName} must use the postgresql scheme.`);
  }

  if (value !== value.trim() || /\s/.test(value)) {
    issues.push(`${variableName} must not contain whitespace.`);
  }

  const host = url.hostname;
  if (!host) {
    issues.push(`${variableName} must include a host.`);
  }

  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!databaseName) {
    issues.push(`${variableName} must include a database name.`);
  }

  if (!url.username) {
    issues.push(`${variableName} must include a username.`);
  }

  const local = LOCAL_HOSTS.has(host);
  if (!local && !url.password) {
    issues.push(`${variableName} must include a password for non-local hosts.`);
  }

  const sslMode = url.searchParams.get("sslmode")?.toLowerCase() ?? null;
  if (!local) {
    if (!sslMode || !REMOTE_TLS_MODES.has(sslMode)) {
      issues.push(
        `${variableName} must set sslmode to require, verify-ca, or verify-full for non-local hosts.`,
      );
    }
  } else if (sslMode && sslMode !== "disable" && !REMOTE_TLS_MODES.has(sslMode)) {
    issues.push(`${variableName} sslmode is not supported.`);
  }

  if (issues.length > 0) {
    return { state: "invalid", issues };
  }

  if (sslMode === "require" || sslMode === "verify-ca" || sslMode === "verify-full") {
    return { state: "configured", connectionString: value, sslMode };
  }

  return { state: "configured", connectionString: value, sslMode: "disable" };
}

export function isPooledConnectionString(connectionString: string): boolean {
  const url = new URL(connectionString);
  if (url.searchParams.get("pgbouncer")?.toLowerCase() === "true") return true;
  return url.hostname.toLowerCase().includes("pooler");
}

/** Removes driver-incompatible Neon parameters without rewriting the userinfo. */
export function normalizeConnectionString(connectionString: string): string {
  return stripQueryParam(connectionString, "channel_binding");
}

function stripQueryParam(connectionString: string, name: string): string {
  const queryIndex = connectionString.indexOf("?");
  if (queryIndex === -1) return connectionString;
  const hashIndex = connectionString.indexOf("#", queryIndex);
  const base = connectionString.slice(0, queryIndex);
  const query = connectionString.slice(queryIndex + 1, hashIndex === -1 ? undefined : hashIndex);
  const hash = hashIndex === -1 ? "" : connectionString.slice(hashIndex);
  const parts = query.split("&").filter((part) => decodeURIComponent(part.split("=")[0] ?? "") !== name);
  return parts.length > 0 ? `${base}?${parts.join("&")}${hash}` : `${base}${hash}`;
}
