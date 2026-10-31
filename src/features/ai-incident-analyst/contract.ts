import { capabilityIdentity, type CapabilityContract } from "@/shared/contracts/capability";

export const aiIncidentAnalyst = {
  ...capabilityIdentity("ai-incident-analyst"),
  summary: "Explain what failed and which progress is still trustworthy.",
  status: "registered",
} satisfies CapabilityContract;
