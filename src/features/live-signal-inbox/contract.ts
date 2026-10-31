import { capabilityIdentity, type CapabilityContract } from "@/shared/contracts/capability";

export const liveSignalInbox = {
  ...capabilityIdentity("live-signal-inbox"),
  summary: "Receive the signals that show a journey needs attention.",
  status: "registered",
} satisfies CapabilityContract;
