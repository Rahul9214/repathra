import { connection } from "next/server";

import {
  getIncident,
  getCurrentOperatorAuth,
  ingestSignal,
  ingestWebhookSignal,
  listIncidents,
  performIncidentAction,
  runDiagnosticProbe,
  type SignalOperationFailure,
} from "@/platform/signals/live";

const JSON_LIMIT = 50_000;

export async function beginSignalRequest(): Promise<void> {
  try {
    await connection();
  } catch {
    // Permit direct route handler invocation in test environments outside request store
  }
}

export async function readSignalJsonBody(
  request: Request,
): Promise<unknown | SignalOperationFailure> {
  const text = await request.text();
  if (text.length > JSON_LIMIT) {
    return {
      ok: false,
      status: 422,
      code: "payload_too_large",
      message: "The submitted payload is too large.",
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

export function isSignalOperationFailure(value: unknown): value is SignalOperationFailure {
  return Boolean(
    value &&
      typeof value === "object" &&
      "ok" in value &&
      (value as Record<string, unknown>).ok === false &&
      "status" in value &&
      "code" in value,
  );
}

export function signalResponse(
  result: SignalOperationFailure | { ok: true; [key: string]: unknown },
): Response {
  if (!result.ok) {
    return Response.json(
      { ok: false, code: result.code, message: result.message },
      { status: result.status, headers: { "cache-control": "no-store" } },
    );
  }
  return Response.json(result, {
    status: 200,
    headers: { "cache-control": "no-store" },
  });
}

export async function listIncidentsResponse(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const params: Record<string, string> = {};
  for (const [key, value] of url.searchParams.entries()) {
    params[key] = value;
  }
  const result = await listIncidents(params);
  return signalResponse(result);
}

export async function ingestSignalResponse(request: Request, body: unknown): Promise<Response> {
  // Check if webhook authorization header is present
  const authHeader =
    request.headers.get("x-webhook-auth") ??
    request.headers.get("authorization");

  if (authHeader) {
    const webhookResult = await ingestWebhookSignal(body, authHeader);
    return signalResponse(webhookResult);
  }

  // First party / observer signal ingestion requires operator privileges
  const operator = await getCurrentOperatorAuth();
  if (!operator.ok) return signalResponse(operator);

  const result = await ingestSignal(body);
  return signalResponse(result);
}

export async function readIncidentDetailResponse(incidentId: string): Promise<Response> {
  const result = await getIncident(incidentId);
  return signalResponse(result);
}

export async function acknowledgeIncidentResponse(
  incidentId: string,
  body: unknown,
): Promise<Response> {
  const rawAction =
    body && typeof body === "object"
      ? { ...body, action: "acknowledge" }
      : { action: "acknowledge" };
  const result = await performIncidentAction(incidentId, rawAction);
  return signalResponse(result);
}

export async function resolveIncidentResponse(
  incidentId: string,
  body: unknown,
): Promise<Response> {
  const rawAction =
    body && typeof body === "object"
      ? { ...body, action: "resolve" }
      : { action: "resolve" };
  const result = await performIncidentAction(incidentId, rawAction);
  return signalResponse(result);
}

export async function diagnosticProbeResponse(body: unknown): Promise<Response> {
  const result = await runDiagnosticProbe(body);
  return signalResponse(result);
}
