export const STEP_TYPES = ["collect", "review", "decide", "wait", "handoff", "complete"] as const;
export const HANDOFF_ROLES = ["operator", "reviewer", "vendor", "requester"] as const;
export const COMPLETE_OUTCOMES = ["accepted", "declined", "withdrawn"] as const;
export const JOURNEY_ORIGINS = ["operator", "sandbox"] as const;
export const TEMPLATE_KEYS = ["vendor-onboarding", "service-intake"] as const;

export type StepType = (typeof STEP_TYPES)[number];
export type HandoffRole = (typeof HANDOFF_ROLES)[number];
export type CompleteOutcome = (typeof COMPLETE_OUTCOMES)[number];
export type JourneyOrigin = (typeof JOURNEY_ORIGINS)[number];
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

type StepBase = {
  id: string;
  title: string;
  instruction: string;
};

export type CollectStep = StepBase & {
  type: "collect";
  fieldKey: string;
  fieldLabel: string;
  required: boolean;
  next: string;
};

export type ReviewStep = StepBase & {
  type: "review";
  next: string;
};

export type DecideOutcome = {
  id: string;
  label: string;
  next: string;
};

export type DecideStep = StepBase & {
  type: "decide";
  outcomes: DecideOutcome[];
};

export type WaitStep = StepBase & {
  type: "wait";
  signalKey: string;
  next: string;
};

export type HandoffStep = StepBase & {
  type: "handoff";
  role: HandoffRole;
  next: string;
};

export type CompleteStep = StepBase & {
  type: "complete";
  outcome: CompleteOutcome;
  next: null;
};

export type JourneyStep = CollectStep | ReviewStep | DecideStep | WaitStep | HandoffStep | CompleteStep;

export type JourneyDocument = {
  title: string;
  summary: string;
  entryStepId: string;
  steps: JourneyStep[];
};

export type JourneyIssue = {
  code: "invalid_shape" | "invalid_transition";
  path: string;
  message: string;
};

export type OperatorAccess =
  | { state: "allowed"; userId: string }
  | { state: "denied"; code: "auth_not_configured" | "unauthenticated" | "unauthorized" };

