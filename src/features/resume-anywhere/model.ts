import type {
  CompleteOutcome,
  JourneyDocument,
  JourneyOrigin,
  JourneyStep,
} from "@/features/journey-studio/model";

export const RUN_STATUSES = ["active", "paused", "completed"] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export type CollectAction = {
  type: "collect";
  value: string;
};

export type ReviewAction = {
  type: "review";
  acknowledged: boolean;
};

export type DecideAction = {
  type: "decide";
  outcomeId: string;
};

export type StepAction = CollectAction | ReviewAction | DecideAction;

export type RunRecord = {
  id: string;
  journeyId: string;
  journeySlug: string;
  journeyTitle: string;
  journeyOrigin: JourneyOrigin;
  sandboxNotice: string | null;
  journeyVersionId: string;
  versionNumber: number;
  contentHash: string;
  ownerId: string;
  currentStepId: string;
  status: RunStatus;
  revision: number;
  collectedValues: Record<string, string>;
  completedStepIds: string[];
  completedOutcome: CompleteOutcome | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type RunListItem = {
  id: string;
  journeySlug: string;
  journeyTitle: string;
  journeyOrigin: JourneyOrigin;
  sandboxNotice: string | null;
  versionNumber: number;
  currentStepId: string;
  currentStepTitle: string;
  status: RunStatus;
  revision: number;
  completedStepCount: number;
  totalStepCount: number;
  completedOutcome: CompleteOutcome | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type RunEventRecord = {
  id: string;
  runId: string;
  sequenceNumber: number;
  eventType: string;
  fromStepId: string | null;
  toStepId: string;
  action: unknown;
  idempotencyKey: string | null;
  actorId: string;
  createdAt: string;
};

export type RunDetail = {
  run: RunRecord;
  document: JourneyDocument;
  currentStep: JourneyStep;
  events: RunEventRecord[];
  isOwner: boolean;
};

export type TransitionResult =
  | {
      ok: true;
      nextStepId: string;
      nextStatus: RunStatus;
      collectedValues: Record<string, string>;
      completedStepIds: string[];
      completedOutcome: CompleteOutcome | null;
      replayed?: boolean;
    }
  | {
      ok: false;
      code: string;
      message: string;
    };
