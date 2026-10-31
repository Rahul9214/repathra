import { describe, expect, it } from "vitest";

import { loadConfig, normalizeConnectionString } from "@/shared/config/env";

const CLOUD_URL =
  "postgresql://app_user:test-password@db.example.com:5432/repathra?sslmode=require";

describe("loadConfig", () => {
  it("treats a missing database URL as not configured", () => {
    const result = loadConfig({ NODE_ENV: "test" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.database).toEqual({ configured: false });
      expect(result.config.nodeEnv).toBe("test");
    }
  });

  it("accepts a cloud URL that requires TLS", () => {
    const result = loadConfig({ NODE_ENV: "production", DATABASE_URL: CLOUD_URL });
    expect(result.ok).toBe(true);
    if (result.ok && result.config.database.configured) {
      expect(result.config.database.sslMode).toBe("require");
    } else {
      throw new Error("expected a configured database");
    }
  });

  it("accepts verify-full for cloud hosts", () => {
    const result = loadConfig({
      NODE_ENV: "production",
      DATABASE_URL: CLOUD_URL.replace("sslmode=require", "sslmode=verify-full"),
    });
    expect(result.ok).toBe(true);
    if (result.ok && result.config.database.configured) {
      expect(result.config.database.sslMode).toBe("verify-full");
    }
  });

  it("accepts a local URL without TLS", () => {
    const result = loadConfig({
      NODE_ENV: "development",
      DATABASE_URL: "postgresql://app_user@127.0.0.1:5432/repathra",
    });
    expect(result.ok).toBe(true);
    if (result.ok && result.config.database.configured) {
      expect(result.config.database.sslMode).toBe("disable");
    }
  });

  it("rejects a remote URL that disables TLS without echoing the secret", () => {
    const secret = "super-secret-token";
    const result = loadConfig({
      NODE_ENV: "production",
      DATABASE_URL: `postgresql://app_user:${secret}@db.example.com:5432/repathra?sslmode=disable`,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const rendered = result.issues.join("\n");
      expect(rendered).toContain("sslmode");
      expect(rendered).not.toContain(secret);
      expect(rendered).not.toContain("db.example.com");
      expect(rendered).not.toContain("postgresql://");
    }
  });

  it("rejects a malformed URL without echoing it", () => {
    const result = loadConfig({
      NODE_ENV: "test",
      DATABASE_URL: "not a database url super-secret-token",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.join("\n")).not.toContain("super-secret-token");
    }
  });

  it("strips channel_binding without rewriting the userinfo", () => {
    const raw =
      "postgresql://app_user:p%40ssword@db.example.com:5432/repathra?sslmode=require&channel_binding=require";
    expect(normalizeConnectionString(raw)).toBe(
      "postgresql://app_user:p%40ssword@db.example.com:5432/repathra?sslmode=require",
    );
  });

  it("does not require DATABASE_URL_UNPOOLED for application configuration", () => {
    const result = loadConfig({ NODE_ENV: "production", DATABASE_URL: CLOUD_URL });
    expect(result.ok).toBe(true);
  });

  it("rejects an unsupported NODE_ENV without echoing the value", () => {
    const result = loadConfig({ NODE_ENV: "super-secret-token" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.join("\n")).toContain("NODE_ENV");
      expect(result.issues.join("\n")).not.toContain("super-secret-token");
    }
  });
});
