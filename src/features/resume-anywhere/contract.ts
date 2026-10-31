import { capabilityIdentity, type CapabilityContract } from "@/shared/contracts/capability";

export const resumeAnywhere = {
  ...capabilityIdentity("resume-anywhere"),
  summary: "Continue an interrupted journey from the last trusted point.",
  status: "registered",
} satisfies CapabilityContract;
