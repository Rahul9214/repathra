import { describe, expect, it } from "vitest";

import { buildHealthReport, type DatabaseProbe } from "@/platform/health/report";
import { LOCKED_CAPABILITIES } from "@/shared/contracts/capability";
import { PRODUCT } from "@/shared/contracts/product";
import type { DatabaseProbeResult } from "@/shared/db/probe";

const now = () => new Date("2026-10-30T12:00:00.000Z");
const cloudUrl = "postgresql://app_user:test-password@db.example.com:5432/repathra?sslmode=require";

function probeReturning(result: DatabaseProbeResult): { probe: DatabaseProbe; calls: string[] } {
  const calls: string[] = [];
  const probe: DatabaseProbe = async (connectionString) => {
    calls.push(connectionString);
    return result;
  };
  return { probe, calls };
}

describe("buildHealthReport", () => {
  it("reports the database as not configured and does not open a connection", async () => {
    const { probe, calls } = probeReturning({ status: "ok", latencyMs: 1 });
    const result = await buildHealthReport({
      env: { NODE_ENV: "test" },
      now,
      probe,
    });

    expect(calls).toEqual([]);
    expect(result.httpStatus).toBe(503);
    expect(result.body).toMatchObject({
      service: PRODUCT.service,
      version: PRODUCT.version,
      tagline: PRODUCT.tagline,
      status: "degraded",
      time: "2026-10-30T12:00:00.000Z",
      checks: {
        configuration: { status: "ok", issues: [] },
        database: { status: "not_configured", latencyMs: null },
      },
    });
    if ("capabilities" in result.body) {
      expect(result.body.capabilities.map((capability) => capability.name)).toEqual(
        LOCKED_CAPABILITIES.map((capability) => capability.name),
      );
    }
  });

  it("returns 200 only after a probe reports the stored contract is present", async () => {
    const { probe, calls } = probeReturning({ status: "ok", latencyMs: 18 });
    const result = await buildHealthReport({
      env: { NODE_ENV: "production", DATABASE_URL: cloudUrl },
      now,
      probe,
    });

    expect(calls).toEqual([cloudUrl]);
    expect(result.httpStatus).toBe(200);
    expect(result.body).toMatchObject({
      status: "ok",
      checks: { database: { status: "ok", latencyMs: 18 } },
    });
    expect(JSON.stringify(result.body)).not.toContain("test-password");
    expect(JSON.stringify(result.body)).not.toContain("db.example.com");
    expect(JSON.stringify(result.body)).not.toContain("postgresql://");
  });

  it("does not probe when configuration is invalid", async () => {
    const { probe, calls } = probeReturning({ status: "ok", latencyMs: 1 });
    const result = await buildHealthReport({
      env: {
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://app_user:super-secret-token@db.example.com:5432/repathra?sslmode=disable",
      },
      now,
      probe,
    });

    expect(calls).toEqual([]);
    expect(result.httpStatus).toBe(503);
    expect(result.body).toMatchObject({
      status: "unavailable",
      checks: {
        configuration: { status: "error" },
        database: { status: "skipped", latencyMs: null },
      },
    });
    expect(JSON.stringify(result.body)).not.toContain("super-secret-token");
  });

  it.each([
    ["schema_not_migrated", "degraded"],
    ["not_seeded", "degraded"],
    ["contract_mismatch", "degraded"],
    ["unreachable", "unavailable"],
  ] as const)("maps a %s probe to %s", async (status, overall) => {
    const { probe } = probeReturning({ status, latencyMs: 9 });
    const result = await buildHealthReport({
      env: { NODE_ENV: "production", DATABASE_URL: cloudUrl },
      now,
      probe,
    });

    expect(result.httpStatus).toBe(503);
    expect(result.body).toMatchObject({
      status: overall,
      checks: { database: { status, latencyMs: 9 } },
    });
  });

  it("treats a throwing probe as unreachable", async () => {
    const probe: DatabaseProbe = async () => {
      throw new Error("postgresql://app_user:super-secret-token@db.example.com/repathra");
    };
    const result = await buildHealthReport({
      env: { NODE_ENV: "production", DATABASE_URL: cloudUrl },
      now,
      probe,
    });

    expect(result.httpStatus).toBe(503);
    expect(result.body).toMatchObject({
      status: "unavailable",
      checks: { database: { status: "unreachable", latencyMs: null } },
    });
    expect(JSON.stringify(result.body)).not.toContain("super-secret-token");
  });
});
