import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrations = path.resolve(process.cwd(), "drizzle/migrations");

describe("resume anywhere migration", () => {
  it("installs journey_run and journey_run_event tables leaving previous migrations untouched", () => {
    const foundation = fs.readFileSync(path.join(migrations, "0000_foundation.sql"), "utf8");
    expect(foundation).toContain('CREATE TYPE "public"."capability_id"');
    expect(foundation).not.toContain("journey_run");

    const studio = fs
      .readdirSync(migrations)
      .filter((name) => name.startsWith("0001_") && name.endsWith(".sql"))
      .map((name) => fs.readFileSync(path.join(migrations, name), "utf8"))
      .join("\n");
    expect(studio).toContain('CREATE TABLE "journey_definition"');
    expect(studio).not.toContain("journey_run");

    const runMigration = fs
      .readdirSync(migrations)
      .filter((name) => name.startsWith("0002_") && name.endsWith(".sql"))
      .map((name) => fs.readFileSync(path.join(migrations, name), "utf8"))
      .join("\n");
    expect(runMigration).toContain('CREATE TABLE "journey_run"');
    expect(runMigration).toContain('CREATE TABLE "journey_run_event"');
    expect(runMigration).toContain('CREATE TYPE "public"."journey_run_status"');
    expect(runMigration).toContain("journey_run_revision_positive");
    expect(runMigration).toContain("journey_run_hash_sha256");
    expect(runMigration).toContain("journey_run_event_idempotency_unique");
  });
});
