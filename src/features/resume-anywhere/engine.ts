import type { CompleteOutcome, JourneyDocument } from "@/features/journey-studio/model";
import { RUN_MESSAGES } from "@/features/resume-anywhere/messages";
import type { RunStatus, StepAction, TransitionResult } from "@/features/resume-anywhere/model";

export function getInitialRunState(document: JourneyDocument): {
  currentStepId: string;
  status: RunStatus;
  completedOutcome: string | null;
} {
  const entryStep = document.steps.find((s) => s.id === document.entryStepId);
  if (!entryStep) {
    throw new Error(`Entry step ${document.entryStepId} not found in journey document`);
  }

  if (entryStep.type === "wait" || entryStep.type === "handoff") {
    return {
      currentStepId: entryStep.id,
      status: "paused",
      completedOutcome: null,
    };
  }

  if (entryStep.type === "complete") {
    return {
      currentStepId: entryStep.id,
      status: "completed",
      completedOutcome: entryStep.outcome,
    };
  }

  return {
    currentStepId: entryStep.id,
    status: "active",
    completedOutcome: null,
  };
}

export function evaluateTransition(input: {
  document: JourneyDocument;
  currentStepId: string;
  status: RunStatus;
  collectedValues: Record<string, string>;
  completedStepIds: string[];
  action: StepAction;
}): TransitionResult {
  const { document, currentStepId, status, collectedValues, completedStepIds, action } = input;

  if (status === "completed") {
    return {
      ok: false,
      code: "run_already_completed",
      message: RUN_MESSAGES.run_already_completed,
    };
  }

  const currentStep = document.steps.find((s) => s.id === currentStepId);
  if (!currentStep) {
    return {
      ok: false,
      code: "current_step_not_found",
      message: RUN_MESSAGES.current_step_not_found,
    };
  }

  if (currentStep.type === "wait") {
    return {
      ok: false,
      code: "step_paused_waiting_for_signal",
      message: RUN_MESSAGES.step_paused_waiting_for_signal,
    };
  }

  if (currentStep.type === "handoff") {
    return {
      ok: false,
      code: "step_paused_waiting_for_handoff",
      message: RUN_MESSAGES.step_paused_waiting_for_handoff,
    };
  }

  if (currentStep.type === "complete") {
    return {
      ok: false,
      code: "run_already_completed",
      message: RUN_MESSAGES.run_already_completed,
    };
  }

  let nextStepId: string;
  const nextCollectedValues: Record<string, string> = { ...collectedValues };

  switch (currentStep.type) {
    case "collect": {
      if (action.type !== "collect") {
        return {
          ok: false,
          code: "invalid_step_type",
          message: RUN_MESSAGES.invalid_step_type,
        };
      }
      const rawVal = action.value ?? "";
      const trimmed = typeof rawVal === "string" ? rawVal.trim() : "";
      if (currentStep.required && trimmed.length === 0) {
        return {
          ok: false,
          code: "missing_required_field",
          message: RUN_MESSAGES.missing_required_field,
        };
      }
      nextCollectedValues[currentStep.fieldKey] = trimmed;
      nextStepId = currentStep.next;
      break;
    }

    case "review": {
      if (action.type !== "review") {
        return {
          ok: false,
          code: "invalid_step_type",
          message: RUN_MESSAGES.invalid_step_type,
        };
      }
      if (action.acknowledged !== true) {
        return {
          ok: false,
          code: "review_acknowledgment_required",
          message: RUN_MESSAGES.review_acknowledgment_required,
        };
      }
      nextStepId = currentStep.next;
      break;
    }

    case "decide": {
      if (action.type !== "decide") {
        return {
          ok: false,
          code: "invalid_step_type",
          message: RUN_MESSAGES.invalid_step_type,
        };
      }
      const outcome = currentStep.outcomes.find((o) => o.id === action.outcomeId);
      if (!outcome) {
        return {
          ok: false,
          code: "invalid_decision_outcome",
          message: RUN_MESSAGES.invalid_decision_outcome,
        };
      }
      nextStepId = outcome.next;
      break;
    }
  }

  const nextStep = document.steps.find((s) => s.id === nextStepId);
  if (!nextStep) {
    return {
      ok: false,
      code: "next_step_not_found",
      message: RUN_MESSAGES.next_step_not_found,
    };
  }

  let nextStatus: RunStatus = "active";
  let completedOutcome: CompleteOutcome | null = null;

  if (nextStep.type === "wait" || nextStep.type === "handoff") {
    nextStatus = "paused";
  } else if (nextStep.type === "complete") {
    nextStatus = "completed";
    completedOutcome = nextStep.outcome;
  }

  const nextCompletedStepIds = completedStepIds.includes(currentStep.id)
    ? completedStepIds
    : [...completedStepIds, currentStep.id];

  return {
    ok: true,
    nextStepId,
    nextStatus,
    collectedValues: nextCollectedValues,
    completedStepIds: nextCompletedStepIds,
    completedOutcome,
  };
}
