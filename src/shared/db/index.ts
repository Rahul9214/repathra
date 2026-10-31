export { buildPostgresOptions, createPostgresClient } from "@/shared/db/connection";
export {
  resolveDrizzleCredentials,
  resolveMigrationConnection,
  UNCONFIGURED_DATABASE_URL,
} from "@/shared/db/drizzle-credentials";
export { probeDatabase } from "@/shared/db/probe";
export type { DatabaseProbeResult } from "@/shared/db/probe";
export { capability, capabilityIdEnum, capabilityStatusEnum, platformRelease } from "@/shared/db/schema";
