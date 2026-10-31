import { capabilityIdentity, type CapabilityContract } from "@/shared/contracts/capability";

export const journeyStudio = {
  ...capabilityIdentity("journey-studio"),
  summary: "Define the journeys whose progress must survive interruption.",
  status: "registered",
} satisfies CapabilityContract;
