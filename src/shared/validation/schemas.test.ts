import { describe, expect, it } from "vitest";

import { healthReportSchema } from "@/shared/validation/schemas";

describe("healthReportSchema", () => {
  it("rejects a payload that is not the health contract", () => {
    const parsed = healthReportSchema.safeParse({
      service: "repathra",
      status: "ok",
    });
    expect(parsed.success).toBe(false);
  });
});
