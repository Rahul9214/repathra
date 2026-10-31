import { describe, expect, it } from "vitest";

import {
  resolveDrizzleCredentials,
  UNCONFIGURED_DATABASE_URL,
} from "@/shared/db/drizzle-credentials";

const CLOUD_URL =
  "postgresql://app_user:test-password@db.example.com:5432/repathra?sslmode=require";

describe("resolveDrizzleCredentials", () => {
  it("uses a non-connecting placeholder for generate when DATABASE_URL is unset", () => {
    const result = resolveDrizzleCredentials({
      argv: ["node", "drizzle-kit", "generate"],
      env: { NODE_ENV: "development" },
    });
    expect(result).toEqual({
      url: UNCONFIGURED_DATABASE_URL,
      source: "unconfigured-placeholder",
    });
  });

  it("refuses migrate when no connection string is set", () => {
    expect(() =>
      resolveDrizzleCredentials({
        argv: ["node", "drizzle-kit", "migrate"],
        env: { NODE_ENV: "development" },
      }),
    ).toThrow(/DATABASE_URL_UNPOOLED is not set/);
  });

  it("uses a direct DATABASE_URL for migrate when no unpooled URL is set", () => {
    const result = resolveDrizzleCredentials({
      argv: ["node", "drizzle-kit", "migrate"],
      env: { NODE_ENV: "production", DATABASE_URL: CLOUD_URL },
    });
    expect(result.source).toBe("application");
    expect(result.url).toBe(CLOUD_URL);
  });

  it("uses DATABASE_URL_UNPOOLED for migrate and does not keep the pooled URL", () => {
    const pooled =
      "postgresql://app_user:pooled-password@ep-example-pooler.c-1.aws.neon.tech/repathra?sslmode=require&channel_binding=require";
    const direct =
      "postgresql://app_user:direct-password@ep-example.c-1.aws.neon.tech/repathra?sslmode=require&channel_binding=require";
    const result = resolveDrizzleCredentials({
      argv: ["node", "drizzle-kit", "migrate"],
      env: {
        NODE_ENV: "development",
        DATABASE_URL: pooled,
        DATABASE_URL_UNPOOLED: direct,
      },
    });
    expect(result.source).toBe("unpooled");
    expect(result.url).toBe(
      "postgresql://app_user:direct-password@ep-example.c-1.aws.neon.tech/repathra?sslmode=require",
    );
    expect(result.url).not.toContain("pooler");
    expect(result.url).not.toContain("channel_binding");
    expect(result.url).not.toContain("pooled-password");
  });

  it("refuses to migrate through a pooled URL when the direct URL is missing", () => {
    expect(() =>
      resolveDrizzleCredentials({
        argv: ["node", "drizzle-kit", "migrate"],
        env: {
          NODE_ENV: "development",
          DATABASE_URL:
            "postgresql://app_user:pooled-password@ep-example-pooler.c-1.aws.neon.tech/repathra?sslmode=require",
        },
      }),
    ).toThrow(/pooled DATABASE_URL/);
  });

  it("refuses generate when the URL disables TLS and does not echo the secret", () => {
    const secret = "super-secret-token";
    const env = {
      NODE_ENV: "production",
      DATABASE_URL: `postgresql://app_user:${secret}@db.example.com:5432/repathra?sslmode=disable`,
    };
    let message = "";

    expect(() => {
      try {
        resolveDrizzleCredentials({
          argv: ["node", "drizzle-kit", "generate"],
          env,
        });
      } catch (error) {
        message = error instanceof Error ? error.message : "";
        throw error;
      }
    }).toThrow(/sslmode/);

    expect(message).not.toContain(secret);
    expect(message).not.toContain("db.example.com");
  });
});
