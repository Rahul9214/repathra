import { describe, expect, it } from "vitest";

import { probeDatabase } from "@/shared/db/probe";

describe("probeDatabase", () => {
  it.skipIf(!process.env.DATABASE_URL)(
    "runs only when DATABASE_URL is present and does not assume success",
    async () => {
      const result = await probeDatabase(process.env.DATABASE_URL as string);
      expect(["ok", "schema_not_migrated", "not_seeded", "contract_mismatch", "unreachable"]).toContain(
        result.status,
      );
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    },
  );
});
