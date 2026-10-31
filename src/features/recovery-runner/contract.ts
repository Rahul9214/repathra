import { capabilityIdentity, type CapabilityContract } from "@/shared/contracts/capability";

export const recoveryRunner = {
  ...capabilityIdentity("recovery-runner"),
  summary: "Carry out an approved recovery plan.",
  status: "registered",
} satisfies CapabilityContract;
