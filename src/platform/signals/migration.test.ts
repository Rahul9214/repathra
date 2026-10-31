import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = path.resolve(process.cwd(), "drizzle/migrations");

describe("live signal inbox migration", () => {
  it("preserves migrations 0000, 0001, and 0002 untouched", () => {
    const f0000 = fs.readFileSync(path.join(migrationsDir, "0000_foundation.sql"), "utf8");
    expect(f0000).toContain('CREATE TYPE "public"."capability_id"');
    expect(f0000).not.toContain('CREATE TABLE "incident"');

    const f0001 = fs
      .readdirSync(migrationsDir)
      .filter((name) => name.startsWith("0001_") && name.endsWith(".sql"))
      .map((name) => fs.readFileSync(path.join(migrationsDir, name), "utf8"))
      .join("\n");
    expect(f0001).toContain('CREATE TABLE "journey_definition"');
    expect(f0001).not.toContain('CREATE TABLE "incident"');

    const f0002 = fs
      .readdirSync(migrationsDir)
      .filter((name) => name.startsWith("0002_") && name.endsWith(".sql"))
      .map((name) => fs.readFileSync(path.join(migrationsDir, name), "utf8"))
      .join("\n");
    expect(f0002).toContain('CREATE TABLE "journey_run"');
    expect(f0002).not.toContain('CREATE TABLE "incident"');
  });

  it("adds migration 0003 with incident, signal, and incident_event tables and constraints", () => {
    const f0003 = fs
      .readdirSync(migrationsDir)
      .filter((name) => name.startsWith("0003_") && name.endsWith(".sql"))
      .map((name) => fs.readFileSync(path.join(migrationsDir, name), "utf8"))
      .join("\n");

    expect(f0003).toContain('CREATE TABLE "incident"');
    expect(f0003).toContain('CREATE TABLE "signal"');
    expect(f0003).toContain('CREATE TABLE "incident_event"');
    expect(f0003).toContain('CREATE TYPE "public"."signal_provenance"');
    expect(f0003).toContain('CREATE TYPE "public"."failure_category"');
    expect(f0003).toContain('CREATE TYPE "public"."incident_severity"');
    expect(f0003).toContain('CREATE TYPE "public"."incident_status"');
    expect(f0003).toContain("incident_occurrence_count_positive");
    expect(f0003).toContain("signal_duration_non_negative");
    expect(f0003).toContain("signal_idempotency_key_unique");
    expect(f0003).toContain("incident_status_severity_idx");
    expect(f0003).toContain("incident_fingerprint_idx");
  });
});
