import { createHash } from "node:crypto";

import type {
  FailureCategory,
  IncidentSeverity,
  SanitizedTelemetry,
} from "./model";

export interface ClassificationInput {
  status?: number | null;
  durationMs: number;
  timedOut?: boolean;
  networkError?: boolean;
  tlsError?: boolean;
  payloadError?: boolean;
  errorName?: string | null;
  errorMessage?: string | null;
}

export interface ClassificationResult {
  failureCategory: FailureCategory;
  severity: IncidentSeverity;
}

export function classifyHttpFailure(input: ClassificationInput): ClassificationResult {
  const { status, durationMs, timedOut, networkError, tlsError, payloadError, errorName, errorMessage } = input;

  const msg = (errorMessage ?? "").toLowerCase();
  const name = (errorName ?? "").toLowerCase();

  // 1. TLS / SSL Failures
  if (
    tlsError ||
    msg.includes("certificate") ||
    msg.includes("tls") ||
    msg.includes("ssl") ||
    name.includes("tlssocket")
  ) {
    return { failureCategory: "tls_error", severity: "critical" };
  }

  // 2. Timeouts
  if (
    timedOut ||
    status === 504 ||
    name === "aborterror" ||
    msg.includes("timed out") ||
    msg.includes("timeout")
  ) {
    const severity: IncidentSeverity = durationMs >= 15_000 ? "critical" : "high";
    return { failureCategory: "timeout", severity };
  }

  // 3. Network Transport Failures
  if (
    networkError ||
    name === "typeerror" ||
    msg.includes("econnrefused") ||
    msg.includes("enotfound") ||
    msg.includes("fetch failed") ||
    msg.includes("network error")
  ) {
    return { failureCategory: "network_error", severity: "high" };
  }

  // 4. Payload / Parsing Errors
  if (payloadError || msg.includes("unexpected token") || msg.includes("malformed json")) {
    return { failureCategory: "payload_error", severity: "medium" };
  }

  // 5. HTTP Status Based Classification
  if (typeof status === "number") {
    if (status >= 500) {
      const severity: IncidentSeverity = status === 500 || status === 502 || status === 503 ? "high" : "medium";
      return { failureCategory: "http_5xx", severity };
    }
    if (status >= 400) {
      if (status === 401 || status === 403) {
        return { failureCategory: "http_4xx", severity: "high" };
      }
      if (status === 429) {
        return { failureCategory: "http_4xx", severity: "medium" };
      }
      return { failureCategory: "http_4xx", severity: "low" };
    }
  }

  // Fallback
  return { failureCategory: "http_5xx", severity: "medium" };
}

export function generateIncidentFingerprint(input: {
  source: string;
  operation: string;
  failureCategory: FailureCategory;
  signalKey?: string | null;
}): string {
  const normalizedSource = input.source.trim().toLowerCase();
  const normalizedOperation = input.operation.trim().toLowerCase();
  const normalizedCategory = input.failureCategory.trim().toLowerCase();
  const normalizedSignalKey = input.signalKey ? input.signalKey.trim().toLowerCase() : "";

  const rawKey = `${normalizedSource}:${normalizedOperation}:${normalizedCategory}:${normalizedSignalKey}`;
  return createHash("sha256").update(rawKey).digest("hex");
}

export function deriveIncidentTitle(input: {
  source: string;
  operation: string;
  failureCategory: FailureCategory;
  telemetry: SanitizedTelemetry;
}): string {
  const { source, operation, failureCategory, telemetry } = input;
  const statusPart = telemetry.status ? ` (HTTP ${telemetry.status})` : "";
  const durationPart = `${telemetry.durationMs}ms`;

  switch (failureCategory) {
    case "timeout":
      return `${source} [${operation}] timed out after ${durationPart}${statusPart}`;
    case "tls_error":
      return `${source} [${operation}] TLS/certificate verification failure`;
    case "network_error":
      return `${source} [${operation}] transport network failure${telemetry.errorMessage ? `: ${telemetry.errorMessage}` : ""}`;
    case "http_5xx":
      return `${source} [${operation}] upstream server error${statusPart}`;
    case "http_4xx":
      return `${source} [${operation}] client/auth error${statusPart}`;
    case "payload_error":
      return `${source} [${operation}] malformed response payload`;
    default:
      return `${source} [${operation}] incident detected`;
  }
}
