import { capabilityIdentity, type CapabilityContract } from "@/shared/contracts/capability";

export const recoveryPlanComposer = {
  ...capabilityIdentity("recovery-plan-composer"),
  summary: "Compose a plan that can restore interrupted progress.",
  status: "registered",
} satisfies CapabilityContract;
