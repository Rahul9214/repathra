import { describe, expect, it } from "vitest";

import { productCapabilities } from "@/features/registry";
import { assertLockedRegistry, CAPABILITY_IDS, LOCKED_CAPABILITIES } from "@/shared/contracts/capability";

describe("product capability registry", () => {
  it("registers the eight locked capabilities in order", () => {
    expect(productCapabilities.map((capability) => capability.id)).toEqual([...CAPABILITY_IDS]);
    expect(productCapabilities.map((capability) => capability.name)).toEqual([
      "Journey Studio",
      "Resume Anywhere",
      "Live Signal Inbox",
      "AI Incident Analyst",
      "Recovery Plan Composer",
      "Trust and Approval Desk",
      "Recovery Runner",
      "Evidence and Outcomes",
    ]);
    expect(productCapabilities.every((capability) => capability.status === "registered")).toBe(true);
    expect(() => assertLockedRegistry(productCapabilities)).not.toThrow();
  });

  it("keeps the database enum tuple aligned with the locked names", () => {
    expect(LOCKED_CAPABILITIES.map((capability) => capability.id)).toEqual([...CAPABILITY_IDS]);
    expect(CAPABILITY_IDS).toHaveLength(8);
  });

  it("rejects a registry that drops a capability", () => {
    expect(() => assertLockedRegistry(productCapabilities.slice(1))).toThrow(/locked product contract/);
  });
});
