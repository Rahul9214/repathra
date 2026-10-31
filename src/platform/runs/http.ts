import { connection } from "next/server";

import type { StepAction } from "@/features/resume-anywhere/model";
import {
  executeStep,
  listMyRuns,
  readRun,
  runResponse,
  startRun,
  type RunOperationFailure,
} from "@/platform/runs/live";

const JSON_LIMIT = 50_000;

export async function beginRunRequest(): Promise<void> {
  try {
    await connection();
  } catch {
    // Permit direct route handler invocation in test environments outside request store
  }
}

export async function readRunJsonBody(
  request: Request,
): Promise<unknown | RunOperationFailure> {
  const text = await request.text();
  if (text.length > JSON_LIMIT) {
    return {
      ok: false,
      status: 422,
      code: "payload_too_large",
      message: "The submitted action payload is too large.",
    };
  }
  if (text.trim() === "") {
    return {
      ok: false,
      status: 400,
      code: "invalid_json",
      message: "Request body must be non-empty JSON.",
    };
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {
      ok: false,
      status: 400,
      code: "invalid_json",
      message: "Request body must be valid JSON.",
    };
  }
}

export function isRunOperationFailure(value: unknown): value is RunOperationFailure {
  return Boolean(
    value &&
      typeof value === "object" &&
      "ok" in value &&
      (value as Record<string, unknown>).ok === false &&
      "status" in value,
  );
}

export function runOperationGuard(failure: RunOperationFailure): Response {
  return runResponse(failure);
}

export async function listRunsResponse(): Promise<Response> {
  return runResponse(await listMyRuns());
}

export async function startRunResponse(body: unknown): Promise<Response> {
  if (!body || typeof body !== "object") {
    return runResponse({
      ok: false,
      status: 422,
      code: "invalid_input",
      message: "Request body must be an object with journeySlug and versionNumber.",
    });
  }

  const record = body as Record<string, unknown>;
  const journeySlug = typeof record.journeySlug === "string" ? record.journeySlug : "";
  const versionNumber = typeof record.versionNumber === "number" ? record.versionNumber : 0;
  const idempotencyKey =
    typeof record.idempotencyKey === "string" ? record.idempotencyKey : undefined;

  const result = await startRun({ journeySlug, versionNumber, idempotencyKey });
  if (result.ok) {
    return Response.json(result, {
      status: 201,
      headers: { "cache-control": "no-store" },
    });
  }
  return runResponse(result);
}

export async function readRunDetailResponse(id: string): Promise<Response> {
  return runResponse(await readRun(id));
}

export async function executeStepResponse(id: string, body: unknown): Promise<Response> {
  if (!body || typeof body !== "object") {
    return runResponse({
      ok: false,
      status: 422,
      code: "invalid_input",
      message: "Request body must be an object with expectedRevision and action.",
    });
  }

  const record = body as Record<string, unknown>;
  const expectedRevision =
    typeof record.expectedRevision === "number" ? record.expectedRevision : 0;
  const action = record.action as StepAction;
  const idempotencyKey =
    typeof record.idempotencyKey === "string" ? record.idempotencyKey : undefined;

  const result = await executeStep({
    runId: id,
    expectedRevision,
    action,
    idempotencyKey,
  });

  return runResponse(result);
}
