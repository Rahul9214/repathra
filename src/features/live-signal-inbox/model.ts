export type SignalProvenance =
  | "observed_http"
  | "authenticated_webhook"
  | "diagnostic";

export const SIGNAL_PROVENANCES: readonly SignalProvenance[] = [
  "observed_http",
  "authenticated_webhook",
  "diagnostic",
] as const;

export type FailureCategory =
  | "http_4xx"
  | "http_5xx"
  | "timeout"
  | "network_error"
  | "tls_error"
  | "payload_error";

export const FAILURE_CATEGORIES: readonly FailureCategory[] = [
  "http_4xx",
  "http_5xx",
  "timeout",
  "network_error",
  "tls_error",
  "payload_error",
] as const;

export type IncidentSeverity = "critical" | "high" | "medium" | "low";

export const INCIDENT_SEVERITIES: readonly IncidentSeverity[] = [
  "critical",
  "high",
  "medium",
  "low",
] as const;

export type IncidentStatus = "open" | "acknowledged" | "resolved";

export const INCIDENT_STATUSES: readonly IncidentStatus[] = [
  "open",
  "acknowledged",
  "resolved",
] as const;

export type IncidentEventType =
  | "incident_opened"
  | "signal_attached"
  | "incident_acknowledged"
  | "incident_resolved";

export const INCIDENT_EVENT_TYPES: readonly IncidentEventType[] = [
  "incident_opened",
  "signal_attached",
  "incident_acknowledged",
  "incident_resolved",
] as const;

export interface SanitizedTelemetry {
  method: string;
  url: string;
  status: number | null;
  durationMs: number;
  errorName?: string | null;
  errorMessage?: string | null;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
}

export interface CapturedSignalInput {
  provenance: SignalProvenance;
  source: string;
  operation: string;
  signalKey?: string | null;
  runId?: string | null;
  failureCategory: FailureCategory;
  telemetry: SanitizedTelemetry;
  correlationId?: string | null;
  idempotencyKey?: string | null;
  metadata?: Record<string, unknown>;
  occurredAt?: string;
}

export interface SignalRecord {
  id: string;
  incidentId: string;
  provenance: SignalProvenance;
  source: string;
  operation: string;
  signalKey: string | null;
  runId: string | null;
  httpMethod: string;
  httpUrl: string;
  httpStatus: number | null;
  durationMs: number;
  failureCategory: FailureCategory;
  correlationId: string | null;
  idempotencyKey: string | null;
  telemetry: SanitizedTelemetry;
  metadata: Record<string, unknown>;
  occurredAt: string;
}

export interface IncidentRecord {
  id: string;
  fingerprint: string;
  title: string;
  source: string;
  operation: string;
  signalKey: string | null;
  severity: IncidentSeverity;
  status: IncidentStatus;
  occurrenceCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionNote: string | null;
}

export interface IncidentEventRecord {
  id: string;
  incidentId: string;
  eventType: IncidentEventType;
  actorId: string;
  notes: string | null;
  createdAt: string;
}

export interface CorrelatedRunSummary {
  runId: string;
  journeyId: string;
  versionNumber: number;
  ownerId: string;
  currentStepId: string;
  status: string;
  updatedAt: string;
}

export interface IncidentDetail {
  incident: IncidentRecord;
  signals: SignalRecord[];
  events: IncidentEventRecord[];
  associatedRuns: CorrelatedRunSummary[];
}

export interface IncidentListItem extends IncidentRecord {
  latestSignalSummary?: {
    httpMethod: string;
    httpStatus: number | null;
    durationMs: number;
    failureCategory: FailureCategory;
  } | null;
}
