import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import type { Sql } from "postgres";

import { interpretStoredContract } from "@/shared/contracts/stored-contract";
import { PLATFORM_RELEASE_ID } from "@/shared/contracts/product";
import { createPostgresClient } from "@/shared/db/connection";
import { readPgCode } from "@/shared/db/postgres-error";
import { capability, platformRelease } from "@/shared/db/schema";

export type DatabaseProbeResult = {
  status: "ok" | "schema_not_migrated" | "not_seeded" | "contract_mismatch" | "unreachable";
  latencyMs: number;
};

const UNDEFINED_TABLE = "42P01";

export async function probeDatabase(connectionString: string): Promise<DatabaseProbeResult> {
  const started = performance.now();
  let client: Sql | undefined;

  try {
    client = createPostgresClient(connectionString);
    const db = drizzle(client);
    await db.execute(sql`select 1`);

    try {
      const capabilities = await db
        .select({ id: capability.id, name: capability.name })
        .from(capability)
        .orderBy(capability.sortOrder);
      const releases = await db
        .select({
          id: platformRelease.id,
          productName: platformRelease.productName,
          productVersion: platformRelease.productVersion,
          tagline: platformRelease.tagline,
        })
        .from(platformRelease)
        .where(eq(platformRelease.id, PLATFORM_RELEASE_ID));

      const status = interpretStoredContract({
        capabilities,
        release: releases.length === 1 ? releases[0] : null,
      });
      const resolved = releases.length > 1 ? "contract_mismatch" : status;
      return { status: resolved, latencyMs: elapsed(started) };
    } catch (error) {
      if (readPgCode(error) === UNDEFINED_TABLE) {
        return { status: "schema_not_migrated", latencyMs: elapsed(started) };
      }
      logProbeFailure(error);
      return { status: "unreachable", latencyMs: elapsed(started) };
    }
  } catch (error) {
    logProbeFailure(error);
    return { status: "unreachable", latencyMs: elapsed(started) };
  } finally {
    if (client) {
      await client.end({ timeout: 5 }).catch(() => undefined);
    }
  }
}

function elapsed(started: number): number {
  return Math.max(0, Math.round(performance.now() - started));
}

function logProbeFailure(error: unknown): void {
  const code = readPgCode(error) ?? (error instanceof Error ? error.name : "unknown");
  console.error("[repathra] database probe failed", { code });
}
