import { productCapabilities } from "@/features/registry";
import { loadConfig, type ConfigEnv } from "@/shared/config/env";
import type { DatabaseCheckStatus, HealthFailure, HealthReport } from "@/shared/contracts/health";
import { PRODUCT } from "@/shared/contracts/product";
import { probeDatabase, type DatabaseProbeResult } from "@/shared/db/probe";
import { healthReportSchema } from "@/shared/validation/schemas";

export const HEALTH_FAILURE: HealthFailure = {
  service: PRODUCT.service,
  status: "unavailable",
  message: "The health report did not match the shared contract.",
};

export type HealthHttpResult =
  | { httpStatus: 200 | 503; body: HealthReport }
  | { httpStatus: 500; body: HealthFailure };

export type DatabaseProbe = (connectionString: string) => Promise<DatabaseProbeResult>;

export async function buildHealthReport(input: {
  env: ConfigEnv;
  now?: () => Date;
  probe?: DatabaseProbe;
}): Promise<HealthHttpResult> {
  const now = input.now ?? (() => new Date());
  const probe = input.probe ?? probeDatabase;
  const loaded = loadConfig(input.env);

  const database = await readDatabaseCheck(loaded, probe);
  const report: HealthReport = {
    service: PRODUCT.service,
    version: PRODUCT.version,
    tagline: PRODUCT.tagline,
    status: overallStatus(loaded.ok, database.status),
    time: now().toISOString(),
    checks: {
      configuration: {
        status: loaded.ok ? "ok" : "error",
        issues: loaded.ok ? [] : loaded.issues,
      },
      database,
    },
    capabilities: productCapabilities.map((capability) => ({ ...capability })),
  };

  const parsed = healthReportSchema.safeParse(report);
  if (!parsed.success) {
    console.error("[repathra] health report failed validation");
    return { httpStatus: 500, body: HEALTH_FAILURE };
  }

  return {
    httpStatus: report.status === "ok" ? 200 : 503,
    body: report,
  };
}

async function readDatabaseCheck(
  loaded: ReturnType<typeof loadConfig>,
  probe: DatabaseProbe,
): Promise<HealthReport["checks"]["database"]> {
  if (!loaded.ok) {
    return { status: "skipped", latencyMs: null };
  }
  if (!loaded.config.database.configured) {
    return { status: "not_configured", latencyMs: null };
  }

  try {
    const result = await probe(loaded.config.database.connectionString);
    return { status: result.status, latencyMs: result.latencyMs };
  } catch {
    return { status: "unreachable", latencyMs: null };
  }
}

function overallStatus(configurationOk: boolean, databaseStatus: DatabaseCheckStatus): HealthReport["status"] {
  if (!configurationOk || databaseStatus === "unreachable") return "unavailable";
  if (databaseStatus === "ok") return "ok";
  return "degraded";
}
