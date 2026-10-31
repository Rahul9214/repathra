import { capabilityIdentity, type CapabilityContract } from "@/shared/contracts/capability";

export const trustAndApprovalDesk = {
  ...capabilityIdentity("trust-and-approval-desk"),
  summary: "Hold recovery actions until a person approves them.",
  status: "registered",
} satisfies CapabilityContract;
