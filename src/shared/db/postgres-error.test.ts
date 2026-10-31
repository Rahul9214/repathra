import { describe, expect, it } from "vitest";

import { readPgCode } from "@/shared/db/postgres-error";

describe("readPgCode", () => {
  it("reads a driver code", () => {
    expect(readPgCode({ code: "42P01" })).toBe("42P01");
  });

  it("reads a code wrapped as the error cause", () => {
    expect(readPgCode({ cause: { code: "28P01" } })).toBe("28P01");
  });

  it("returns undefined when no code is present", () => {
    expect(readPgCode(new Error("connection failed at db.example.com"))).toBeUndefined();
  });
});
