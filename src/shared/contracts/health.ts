import type { CapabilityContract } from "@/shared/contracts/capability";
import type { PRODUCT } from "@/shared/contracts/product";

export const OVERALL_HEALTH_STATUSES = ["ok", "degraded", "unavailable"] as const;
export const CONFIGURATION_CHECK_STATUSES = ["ok", "error"] as const;
export const DATABASE_CHECK_STATUSES = [
  "ok",
  "not_configured",
  "skipped",
  "schema_not_migrated",
  "not_seeded",
  "contract_mismatch",
  "unreachable",
] as const;

export type OverallHealthStatus = (typeof OVERALL_HEALTH_STATUSES)[number];
export type ConfigurationCheckStatus = (typeof CONFIGURATION_CHECK_STATUSES)[number];
export type DatabaseCheckStatus = (typeof DATABASE_CHECK_STATUSES)[number];

export type HealthReport = {
  service: typeof PRODUCT.service;
  version: typeof PRODUCT.version;
  tagline: typeof PRODUCT.tagline;
  status: OverallHealthStatus;
  time: string;
  checks: {
    configuration: {
      status: ConfigurationCheckStatus;
      issues: string[];
    };
    database: {
      status: DatabaseCheckStatus;
      latencyMs: number | null;
    };
  };
  capabilities: CapabilityContract[];
};

export type HealthFailure = {
  service: typeof PRODUCT.service;
  status: "unavailable";
  message: string;
};
