import { capabilityIdentity, type CapabilityContract } from "@/shared/contracts/capability";

export const evidenceAndOutcomes = {
  ...capabilityIdentity("evidence-and-outcomes"),
  summary: "Record what ran and whether progress was restored.",
  status: "registered",
} satisfies CapabilityContract;
