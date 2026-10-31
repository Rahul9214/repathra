import { LOCKED_CAPABILITIES } from "@/shared/contracts/capability";
import { PLATFORM_RELEASE_ID, PRODUCT } from "@/shared/contracts/product";

export type StoredCapabilityRow = {
  id: string;
  name: string;
};

export type StoredReleaseRow = {
  id: string;
  productName: string;
  productVersion: string;
  tagline: string;
};

export type StoredContractState = "ok" | "not_seeded" | "contract_mismatch";

export function interpretStoredContract(input: {
  capabilities: readonly StoredCapabilityRow[];
  release: StoredReleaseRow | null;
}): StoredContractState {
  if (input.capabilities.length === 0 && input.release === null) {
    return "not_seeded";
  }

  const capabilitiesMatch =
    input.capabilities.length === LOCKED_CAPABILITIES.length &&
    input.capabilities.every((row, index) => {
      const locked = LOCKED_CAPABILITIES[index];
      return row.id === locked.id && row.name === locked.name;
    });

  const releaseMatches =
    input.release !== null &&
    input.release.id === PLATFORM_RELEASE_ID &&
    input.release.productName === PRODUCT.name &&
    input.release.productVersion === PRODUCT.version &&
    input.release.tagline === PRODUCT.tagline;

  return capabilitiesMatch && releaseMatches ? "ok" : "contract_mismatch";
}
