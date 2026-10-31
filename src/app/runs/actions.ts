"use server";

import type { StepAction } from "@/features/resume-anywhere/model";
import { executeStep, startRun } from "@/platform/runs/live";

export async function startRunAction(journeySlug: string, versionNumber: number) {
  return await startRun({ journeySlug, versionNumber });
}

export async function executeStepAction(
  runId: string,
  expectedRevision: number,
  action: StepAction,
  idempotencyKey?: string,
) {
  return await executeStep({
    runId,
    expectedRevision,
    action,
    idempotencyKey,
  });
}
