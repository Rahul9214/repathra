import { describe, expect, it } from "vitest";

import packageJson from "../../../package.json";
import { PRODUCT } from "@/shared/contracts/product";

describe("product identity", () => {
  it("uses the version 2 tagline and matches package.json", () => {
    expect(PRODUCT).toEqual({
      service: "repathra",
      name: "REPATHRA",
      version: "2.0.0",
      tagline: "Progress is not disposable.",
    });
    expect(packageJson.version).toBe(PRODUCT.version);
  });
});
