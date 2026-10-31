import { describe, expect, it } from "vitest";

import { buildPostgresOptions } from "@/shared/db/connection";

describe("buildPostgresOptions", () => {
  it("requires TLS for a cloud connection string", () => {
    const options = buildPostgresOptions(
      "postgresql://app_user:test-password@db.example.com:5432/repathra?sslmode=require",
    );
    expect(options.ssl).toBe("require");
    expect(options.max).toBe(1);
    expect(options.connection?.application_name).toBe("repathra");
    expect(JSON.stringify(options)).not.toContain("test-password");
  });

  it("uses verify-full when the URL asks for it", () => {
    const options = buildPostgresOptions(
      "postgresql://app_user:test-password@db.example.com:5432/repathra?sslmode=verify-full",
    );
    expect(options.ssl).toBe("verify-full");
  });

  it("does not force TLS for loopback", () => {
    const options = buildPostgresOptions("postgresql://app_user@127.0.0.1:5432/repathra");
    expect(options.ssl).toBe(false);
  });

  it("disables prepared statements for pooler hosts", () => {
    const options = buildPostgresOptions(
      "postgresql://app_user:test-password@ep-example-pooler.region.aws.neon.tech/repathra?sslmode=require",
    );
    expect(options.prepare).toBe(false);
    expect(options.ssl).toBe("require");
  });
});
