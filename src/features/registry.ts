import { assertLockedRegistry, type CapabilityContract } from "@/shared/contracts/capability";
import { aiIncidentAnalyst } from "@/features/ai-incident-analyst";
import { evidenceAndOutcomes } from "@/features/evidence-and-outcomes";
import { journeyStudio } from "@/features/journey-studio";
import { liveSignalInbox } from "@/features/live-signal-inbox";
import { recoveryPlanComposer } from "@/features/recovery-plan-composer";
import { recoveryRunner } from "@/features/recovery-runner";
import { resumeAnywhere } from "@/features/resume-anywhere";
import { trustAndApprovalDesk } from "@/features/trust-and-approval-desk";

export const productCapabilities = [
  journeyStudio,
  resumeAnywhere,
  liveSignalInbox,
  aiIncidentAnalyst,
  recoveryPlanComposer,
  trustAndApprovalDesk,
  recoveryRunner,
  evidenceAndOutcomes,
] as const satisfies readonly CapabilityContract[];

assertLockedRegistry(productCapabilities);
