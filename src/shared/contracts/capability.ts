export const LOCKED_CAPABILITIES = [
  { id: "journey-studio", name: "Journey Studio" },
  { id: "resume-anywhere", name: "Resume Anywhere" },
  { id: "live-signal-inbox", name: "Live Signal Inbox" },
  { id: "ai-incident-analyst", name: "AI Incident Analyst" },
  { id: "recovery-plan-composer", name: "Recovery Plan Composer" },
  { id: "trust-and-approval-desk", name: "Trust and Approval Desk" },
  { id: "recovery-runner", name: "Recovery Runner" },
  { id: "evidence-and-outcomes", name: "Evidence and Outcomes" },
] as const;

export const CAPABILITY_IDS = [
  "journey-studio",
  "resume-anywhere",
  "live-signal-inbox",
  "ai-incident-analyst",
  "recovery-plan-composer",
  "trust-and-approval-desk",
  "recovery-runner",
  "evidence-and-outcomes",
] as const;

export type CapabilityId = (typeof CAPABILITY_IDS)[number];

/** Foundation records the capability. Later modules replace this status when they ship. */
export const CAPABILITY_STATUSES = ["registered"] as const;

export type CapabilityStatus = (typeof CAPABILITY_STATUSES)[number];

export type CapabilityContract = {
  id: CapabilityId;
  name: string;
  summary: string;
  status: CapabilityStatus;
};

export function capabilityIdentity(id: CapabilityId): { id: CapabilityId; name: string } {
  const found = LOCKED_CAPABILITIES.find((capability) => capability.id === id);
  if (!found) {
    throw new Error("Unknown capability id.");
  }
  return { id: found.id, name: found.name };
}

export function assertLockedRegistry(capabilities: readonly CapabilityContract[]): void {
  const matches =
    capabilities.length === LOCKED_CAPABILITIES.length &&
    capabilities.every((capability, index) => {
      const locked = LOCKED_CAPABILITIES[index];
      return (
        capability.id === locked.id &&
        capability.name === locked.name &&
        capability.status === "registered" &&
        capability.summary.trim().length > 0
      );
    });

  if (!matches) {
    throw new Error("Capability registry does not match the locked product contract.");
  }
}

const capabilityIdsMatchLockedList =
  LOCKED_CAPABILITIES.length === CAPABILITY_IDS.length &&
  LOCKED_CAPABILITIES.every((capability, index) => capability.id === CAPABILITY_IDS[index]);

if (!capabilityIdsMatchLockedList) {
  throw new Error("Locked capability ids do not match CAPABILITY_IDS.");
}
