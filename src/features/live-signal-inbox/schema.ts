import { z } from "zod";


export const sanitizedTelemetrySchema = z.object({
  method: z.string().min(1).max(16),
  url: z.string().min(1).max(2048),
  status: z.number().int().min(100).max(599).nullable().optional(),
  durationMs: z.number().int().min(0).max(600_000),
  errorName: z.string().max(256).nullable().optional(),
  errorMessage: z.string().max(2048).nullable().optional(),
  requestHeaders: z.record(z.string(), z.string()).optional(),
  responseHeaders: z.record(z.string(), z.string()).optional(),
});

export const captureSignalSchema = z.object({
  provenance: z.enum(["observed_http", "authenticated_webhook", "diagnostic"]).default("observed_http"),
  source: z.string().min(1).max(128),
  operation: z.string().min(1).max(128),
  signalKey: z.string().max(128).nullable().optional(),
  runId: z.string().uuid().nullable().optional(),
  failureCategory: z.enum([
    "http_4xx",
    "http_5xx",
    "timeout",
    "network_error",
    "tls_error",
    "payload_error",
  ]),
  telemetry: sanitizedTelemetrySchema,
  correlationId: z.string().max(256).nullable().optional(),
  idempotencyKey: z.string().max(256).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  occurredAt: z.string().datetime().optional(),
});

export const webhookSignalSchema = z.object({
  source: z.string().min(1).max(128),
  operation: z.string().min(1).max(128),
  signalKey: z.string().max(128).nullable().optional(),
  runId: z.string().uuid().nullable().optional(),
  failureCategory: z.enum([
    "http_4xx",
    "http_5xx",
    "timeout",
    "network_error",
    "tls_error",
    "payload_error",
  ]).default("http_5xx"),
  status: z.number().int().min(100).max(599).nullable().optional(),
  durationMs: z.number().int().min(0).default(0),
  message: z.string().max(2048).optional(),
  correlationId: z.string().max(256).nullable().optional(),
  idempotencyKey: z.string().max(256).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const diagnosticProbeSchema = z.object({
  targetUrl: z.string().url().max(2048),
  method: z.enum(["GET", "POST", "HEAD"]).default("GET"),
  timeoutMs: z.number().int().min(500).max(30000).default(5000),
  source: z.string().min(1).max(128).default("diagnostic-probe"),
  operation: z.string().min(1).max(128).default("health-check"),
  signalKey: z.string().max(128).nullable().optional(),
  runId: z.string().uuid().nullable().optional(),
});

export const acknowledgeIncidentSchema = z.object({
  action: z.literal("acknowledge"),
  notes: z.string().max(1024).optional(),
});

export const resolveIncidentSchema = z.object({
  action: z.literal("resolve"),
  resolutionNote: z.string().min(3, "A resolution note of at least 3 characters is required.").max(2048),
});

export const incidentActionSchema = z.discriminatedUnion("action", [
  acknowledgeIncidentSchema,
  resolveIncidentSchema,
]);

export const incidentFilterSchema = z.object({
  status: z.enum(["open", "acknowledged", "resolved"]).optional(),
  severity: z.enum(["critical", "high", "medium", "low"]).optional(),
  source: z.string().max(128).optional(),
  signalKey: z.string().max(128).optional(),
  search: z.string().max(256).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
