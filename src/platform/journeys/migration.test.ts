import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrations = path.resolve(process.cwd(), "drizzle/migrations");

describe("journey studio migration", () => {
  it("leaves the module 001 foundation migration untouched and freezes published versions", () => {
    const foundation = fs.readFileSync(path.join(migrations, "0000_foundation.sql"), "utf8");
    expect(foundation).toContain("CREATE TYPE \"public\".\"capability_id\"");
    expect(foundation).not.toContain("journey_version");

    const journey = fs
      .readdirSync(migrations)
      .filter((name) => name.startsWith("0001_") && name.endsWith(".sql"))
      .map((name) => fs.readFileSync(path.join(migrations, name), "utf8"))
      .join("\n");
    expect(journey).toContain("CREATE TABLE \"journey_definition\"");
    expect(journey).toContain("CREATE TABLE \"journey_draft\"");
    expect(journey).toContain("CREATE TABLE \"journey_version\"");
    expect(journey).toContain("journey_version rows are immutable");
    expect(journey).toContain("BEFORE UPDATE ON \"journey_version\"");
    expect(journey).toContain("BEFORE DELETE ON \"journey_version\"");
    expect(journey).not.toContain("capability_status");
  });
});
