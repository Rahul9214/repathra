import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { journeyRun } from "./run-schema";

export const signalProvenanceEnum = pgEnum("signal_provenance", [
  "observed_http",
  "authenticated_webhook",
  "diagnostic",
]);
export const failureCategoryEnum = pgEnum("failure_category", [
  "http_4xx",
  "http_5xx",
  "timeout",
  "network_error",
  "tls_error",
  "payload_error",
]);
export const incidentSeverityEnum = pgEnum("incident_severity", [
  "critical",
  "high",
  "medium",
  "low",
]);
export const incidentStatusEnum = pgEnum("incident_status", [
  "open",
  "acknowledged",
  "resolved",
]);

export const incident = pgTable(
  "incident",
  {
    id: uuid("id").primaryKey(),
    fingerprint: text("fingerprint").notNull(),
    title: text("title").notNull(),
    source: text("source").notNull(),
    operation: text("operation").notNull(),
    signalKey: text("signal_key"),
    severity: incidentSeverityEnum("severity").notNull(),
    status: incidentStatusEnum("status").notNull().default("open"),
    occurrenceCount: integer("occurrence_count").notNull().default(1),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    acknowledgedBy: text("acknowledged_by"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedBy: text("resolved_by"),
    resolutionNote: text("resolution_note"),
  },
  (table) => [
    index("incident_status_severity_idx").on(table.status, table.severity),
    index("incident_fingerprint_idx").on(table.fingerprint),
    index("incident_last_seen_idx").on(table.lastSeenAt),
    index("incident_signal_key_idx").on(table.signalKey),
    check("incident_occurrence_count_positive", sql`${table.occurrenceCount} >= 1`),
  ],
);

export const signal = pgTable(
  "signal",
  {
    id: uuid("id").primaryKey(),
    incidentId: uuid("incident_id")
      .notNull()
      .references(() => incident.id, { onDelete: "cascade" }),
    provenance: signalProvenanceEnum("provenance").notNull(),
    source: text("source").notNull(),
    operation: text("operation").notNull(),
    signalKey: text("signal_key"),
    runId: uuid("run_id").references(() => journeyRun.id, { onDelete: "set null" }),
    httpMethod: text("http_method").notNull(),
    httpUrl: text("http_url").notNull(),
    httpStatus: integer("http_status"),
    durationMs: integer("duration_ms").notNull(),
    failureCategory: failureCategoryEnum("failure_category").notNull(),
    correlationId: text("correlation_id"),
    idempotencyKey: text("idempotency_key"),
    telemetry: jsonb("telemetry").notNull().default(sql`'{}'::jsonb`),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("signal_incident_occurred_idx").on(table.incidentId, table.occurredAt),
    index("signal_run_idx").on(table.runId),
    uniqueIndex("signal_idempotency_key_unique")
      .on(table.idempotencyKey)
      .where(sql`${table.idempotencyKey} is not null`),
    check("signal_duration_non_negative", sql`${table.durationMs} >= 0`),
  ],
);

export const incidentEvent = pgTable(
  "incident_event",
  {
    id: uuid("id").primaryKey(),
    incidentId: uuid("incident_id")
      .notNull()
      .references(() => incident.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    actorId: text("actor_id").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("incident_event_incident_created_idx").on(table.incidentId, table.createdAt),
  ],
);
