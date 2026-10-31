import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { loadProjectEnv } from "@/shared/config/load-env";

const originalDatabaseUrl = process.env.DATABASE_URL;
const originalNodeEnv = process.env.NODE_ENV;
const createdDirs: string[] = [];
const mutableEnv = process.env as { NODE_ENV?: string; DATABASE_URL?: string };

afterEach(() => {
  if (originalDatabaseUrl === undefined) {
    delete mutableEnv.DATABASE_URL;
  } else {
    mutableEnv.DATABASE_URL = originalDatabaseUrl;
  }
  if (originalNodeEnv === undefined) {
    delete mutableEnv.NODE_ENV;
  } else {
    mutableEnv.NODE_ENV = originalNodeEnv;
  }
  for (const dir of createdDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("loadProjectEnv", () => {
  it("loads .env.local from an absolute directory", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "repathra-env-"));
    createdDirs.push(dir);
    const url = "postgresql://app_user:test-password@db.example.com:5432/repathra?sslmode=require";
    fs.writeFileSync(path.join(dir, ".env.local"), `DATABASE_URL=${url}\n`, "utf8");
    delete mutableEnv.DATABASE_URL;
    mutableEnv.NODE_ENV = "development";

    loadProjectEnv(dir);

    expect(process.env.DATABASE_URL).toBe(url);
  });

  it("loads a UTF-8 file that starts with a BOM", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "repathra-env-"));
    createdDirs.push(dir);
    const url = "postgresql://app_user:test-password@db.example.com:5432/repathra?sslmode=require";
    fs.writeFileSync(path.join(dir, ".env.local"), `\uFEFFDATABASE_URL=${url}\n`, "utf8");
    delete mutableEnv.DATABASE_URL;
    mutableEnv.NODE_ENV = "development";

    loadProjectEnv(dir);

    expect(process.env.DATABASE_URL).toBe(url);
  });

  it("refuses a UTF-16 env file without reading it into the process", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "repathra-env-"));
    createdDirs.push(dir);
    fs.writeFileSync(path.join(dir, ".env.local"), Buffer.from([0xff, 0xfe, 0x41, 0x00]));
    delete mutableEnv.DATABASE_URL;
    mutableEnv.NODE_ENV = "development";

    expect(() => loadProjectEnv(dir)).toThrow(/UTF-16/);
    expect(process.env.DATABASE_URL).toBeUndefined();
  });
});
