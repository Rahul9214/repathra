import { describe, expect, it } from "vitest";

import { LOCKED_CAPABILITIES } from "@/shared/contracts/capability";
import { PLATFORM_RELEASE_ID, PRODUCT } from "@/shared/contracts/product";
import { interpretStoredContract } from "@/shared/contracts/stored-contract";

const matchingCapabilities = LOCKED_CAPABILITIES.map((capability) => ({
  id: capability.id,
  name: capability.name,
}));

const matchingRelease = {
  id: PLATFORM_RELEASE_ID,
  productName: PRODUCT.name,
  productVersion: PRODUCT.version,
  tagline: PRODUCT.tagline,
};

describe("interpretStoredContract", () => {
  it("accepts the locked capability order and product identity", () => {
    expect(
      interpretStoredContract({
        capabilities: matchingCapabilities,
        release: matchingRelease,
      }),
    ).toBe("ok");
  });

  it("reports an empty database as not seeded", () => {
    expect(interpretStoredContract({ capabilities: [], release: null })).toBe("not_seeded");
  });

  it("rejects a partial capability list", () => {
    expect(
      interpretStoredContract({
        capabilities: matchingCapabilities.slice(0, 1),
        release: matchingRelease,
      }),
    ).toBe("contract_mismatch");
  });

  it("rejects capabilities stored out of order", () => {
    expect(
      interpretStoredContract({
        capabilities: [...matchingCapabilities].reverse(),
        release: matchingRelease,
      }),
    ).toBe("contract_mismatch");
  });

  it("rejects a release row that does not match the product identity", () => {
    expect(
      interpretStoredContract({
        capabilities: matchingCapabilities,
        release: { ...matchingRelease, tagline: "something else" },
      }),
    ).toBe("contract_mismatch");
  });

  it("rejects capabilities that are present without the release row", () => {
    expect(
      interpretStoredContract({
        capabilities: matchingCapabilities,
        release: null,
      }),
    ).toBe("contract_mismatch");
  });
});
