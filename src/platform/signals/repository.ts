import { randomUUID } from "node:crypto";

import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";

import {
  deriveIncidentTitle,
  generateIncidentFingerprint,
} from "@/features/live-signal-inbox/classifier";
import type {
  CapturedSignalInput,
  CorrelatedRunSummary,
  FailureCategory,
  IncidentDetail,
  IncidentEventRecord,
  IncidentListItem,
  IncidentRecord,
  IncidentSeverity,
  IncidentStatus,
  SanitizedTelemetry,
  SignalProvenance,
  SignalRecord,
} from "@/features/live-signal-inbox/model";
import { createPostgresClient } from "@/shared/db/connection";
import { journeyVersion } from "@/shared/db/journey-schema";
import { journeyRun } from "@/shared/db/run-schema";
import {
  incident,
  incidentEvent,
  signal,
} from "@/shared/db/signal-schema";

type Database = PostgresJsDatabase;

const SEVERITY_RANK: Record<IncidentSeverity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

function getHigherSeverity(a: IncidentSeverity, b: IncidentSeverity): IncidentSeverity {
  return SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b;
}

export type RecordSignalResult =
  | {
      ok: true;
      incident: IncidentRecord;
      signal: SignalRecord;
      replayed: boolean;
      isNewIncident: boolean;
    }
  | {
      ok: false;
      code: string;
      message: string;
    };

function mapIncidentRow(row: typeof incident.$inferSelect): IncidentRecord {
  return {
    id: row.id,
    fingerprint: row.fingerprint,
    title: row.title,
    source: row.source,
    operation: row.operation,
    signalKey: row.signalKey ?? null,
    severity: row.severity as IncidentSeverity,
    status: row.status as IncidentStatus,
    occurrenceCount: row.occurrenceCount,
    firstSeenAt: row.firstSeenAt.toISOString(),
    lastSeenAt: row.lastSeenAt.toISOString(),
    acknowledgedAt: row.acknowledgedAt?.toISOString() ?? null,
    acknowledgedBy: row.acknowledgedBy ?? null,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    resolvedBy: row.resolvedBy ?? null,
    resolutionNote: row.resolutionNote ?? null,
  };
}

function mapSignalRow(row: typeof signal.$inferSelect): SignalRecord {
  return {
    id: row.id,
    incidentId: row.incidentId,
    provenance: row.provenance as SignalProvenance,
    source: row.source,
    operation: row.operation,
    signalKey: row.signalKey ?? null,
    runId: row.runId ?? null,
    httpMethod: row.httpMethod,
    httpUrl: row.httpUrl,
    httpStatus: row.httpStatus ?? null,
    durationMs: row.durationMs,
    failureCategory: row.failureCategory as FailureCategory,
    correlationId: row.correlationId ?? null,
    idempotencyKey: row.idempotencyKey ?? null,
    telemetry: row.telemetry as SanitizedTelemetry,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    occurredAt: row.occurredAt.toISOString(),
  };
}

function mapIncidentEventRow(row: typeof incidentEvent.$inferSelect): IncidentEventRecord {
  return {
    id: row.id,
    incidentId: row.incidentId,
    eventType: row.eventType as IncidentEventRecord["eventType"],
    actorId: row.actorId,
    notes: row.notes ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function recordSignal(
  connectionString: string,
  input: CapturedSignalInput,
): Promise<RecordSignalResult> {
  const client = createPostgresClient(connectionString);
  const db = drizzle(client);

  try {
    return await db.transaction(async (tx: Database) => {
      // 1. Check idempotency if idempotencyKey is provided
      if (input.idempotencyKey) {
        const [existingSignal] = await tx
          .select()
          .from(signal)
          .where(eq(signal.idempotencyKey, input.idempotencyKey))
          .limit(1);

        if (existingSignal) {
          const [parentIncident] = await tx
            .select()
            .from(incident)
            .where(eq(incident.id, existingSignal.incidentId))
            .limit(1);

          if (parentIncident) {
            return {
              ok: true as const,
              incident: mapIncidentRow(parentIncident),
              signal: mapSignalRow(existingSignal),
              replayed: true,
              isNewIncident: false,
            };
          }
        }
      }

      // 2. Deterministic correlation
      const fingerprint = generateIncidentFingerprint({
        source: input.source,
        operation: input.operation,
        failureCategory: input.failureCategory,
        signalKey: input.signalKey,
      });

      const title = deriveIncidentTitle({
        source: input.source,
        operation: input.operation,
        failureCategory: input.failureCategory,
        telemetry: input.telemetry,
      });

      const now = input.occurredAt ? new Date(input.occurredAt) : new Date();
      const signalId = randomUUID();

      // Look for active (open or acknowledged) incident with this fingerprint
      const [existingActive] = await tx
        .select()
        .from(incident)
        .where(
          and(
            eq(incident.fingerprint, fingerprint),
            or(eq(incident.status, "open"), eq(incident.status, "acknowledged")),
          ),
        )
        .limit(1);

      if (existingActive) {
        // Upgrade severity if new signal is higher severity
        const updatedSeverity = getHigherSeverity(existingActive.severity as IncidentSeverity, input.telemetry.status && input.telemetry.status >= 500 ? "high" : "medium");

        await tx
          .update(incident)
          .set({
            occurrenceCount: existingActive.occurrenceCount + 1,
            lastSeenAt: now,
            severity: updatedSeverity,
          })
          .where(eq(incident.id, existingActive.id));

        await tx.insert(signal).values({
          id: signalId,
          incidentId: existingActive.id,
          provenance: input.provenance,
          source: input.source,
          operation: input.operation,
          signalKey: input.signalKey ?? null,
          runId: input.runId ?? null,
          httpMethod: input.telemetry.method,
          httpUrl: input.telemetry.url,
          httpStatus: input.telemetry.status ?? null,
          durationMs: input.telemetry.durationMs,
          failureCategory: input.failureCategory,
          correlationId: input.correlationId ?? null,
          idempotencyKey: input.idempotencyKey ?? null,
          telemetry: input.telemetry,
          metadata: input.metadata ?? {},
          occurredAt: now,
        });

        await tx.insert(incidentEvent).values({
          id: randomUUID(),
          incidentId: existingActive.id,
          eventType: "signal_attached",
          actorId: input.provenance === "diagnostic" ? "diagnostic:probe" : "system:observer",
          notes: `${title} (occurrence #${existingActive.occurrenceCount + 1})`,
          createdAt: now,
        });

        const [refreshedIncident] = await tx
          .select()
          .from(incident)
          .where(eq(incident.id, existingActive.id))
          .limit(1);

        const [createdSignal] = await tx
          .select()
          .from(signal)
          .where(eq(signal.id, signalId))
          .limit(1);

        return {
          ok: true as const,
          incident: mapIncidentRow(refreshedIncident),
          signal: mapSignalRow(createdSignal),
          replayed: false,
          isNewIncident: false,
        };
      }

      // No active incident found -> Create new incident
      const incidentId = randomUUID();
      const initialSeverity = input.telemetry.status && input.telemetry.status >= 500 ? "high" : "medium";

      await tx.insert(incident).values({
        id: incidentId,
        fingerprint,
        title,
        source: input.source,
        operation: input.operation,
        signalKey: input.signalKey ?? null,
        severity: initialSeverity,
        status: "open",
        occurrenceCount: 1,
        firstSeenAt: now,
        lastSeenAt: now,
      });

      await tx.insert(signal).values({
        id: signalId,
        incidentId,
        provenance: input.provenance,
        source: input.source,
        operation: input.operation,
        signalKey: input.signalKey ?? null,
        runId: input.runId ?? null,
        httpMethod: input.telemetry.method,
        httpUrl: input.telemetry.url,
        httpStatus: input.telemetry.status ?? null,
        durationMs: input.telemetry.durationMs,
        failureCategory: input.failureCategory,
        correlationId: input.correlationId ?? null,
        idempotencyKey: input.idempotencyKey ?? null,
        telemetry: input.telemetry,
        metadata: input.metadata ?? {},
        occurredAt: now,
      });

      await tx.insert(incidentEvent).values({
        id: randomUUID(),
        incidentId,
        eventType: "incident_opened",
        actorId: input.provenance === "diagnostic" ? "diagnostic:probe" : "system:observer",
        notes: `Incident opened: ${title}`,
        createdAt: now,
      });

      const [createdIncident] = await tx
        .select()
        .from(incident)
        .where(eq(incident.id, incidentId))
        .limit(1);

      const [createdSignal] = await tx
        .select()
        .from(signal)
        .where(eq(signal.id, signalId))
        .limit(1);

      return {
        ok: true as const,
        incident: mapIncidentRow(createdIncident),
        signal: mapSignalRow(createdSignal),
        replayed: false,
        isNewIncident: true,
      };
    });
  } finally {
    await client.end();
  }
}

export interface ListIncidentsFilter {
  status?: IncidentStatus;
  severity?: IncidentSeverity;
  source?: string;
  signalKey?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export async function listStoredIncidents(
  connectionString: string,
  filter?: ListIncidentsFilter,
): Promise<{ incidents: IncidentListItem[]; totalCount: number }> {
  const client = createPostgresClient(connectionString);
  const db = drizzle(client);

  const limit = Math.min(Math.max(filter?.limit ?? 20, 1), 100);
  const offset = Math.max(filter?.offset ?? 0, 0);

  try {
    const conditions = [];

    if (filter?.status) {
      conditions.push(eq(incident.status, filter.status));
    }
    if (filter?.severity) {
      conditions.push(eq(incident.severity, filter.severity));
    }
    if (filter?.source) {
      conditions.push(eq(incident.source, filter.source));
    }
    if (filter?.signalKey) {
      conditions.push(eq(incident.signalKey, filter.signalKey));
    }
    if (filter?.search && filter.search.trim() !== "") {
      const term = `%${filter.search.trim()}%`;
      conditions.push(
        or(
          ilike(incident.title, term),
          ilike(incident.source, term),
          ilike(incident.operation, term),
        ),
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(incident)
      .where(whereClause);

    const totalCount = countResult[0]?.count ?? 0;

    const rows = await db
      .select()
      .from(incident)
      .where(whereClause)
      .orderBy(desc(incident.lastSeenAt))
      .limit(limit)
      .offset(offset);

    // Fetch the latest signal summary for each incident
    const incidentIds = rows.map((r) => r.id);
    const signalMap = new Map<string, typeof signal.$inferSelect>();

    if (incidentIds.length > 0) {
      const latestSignals = await db
        .select()
        .from(signal)
        .where(inArray(signal.incidentId, incidentIds))
        .orderBy(desc(signal.occurredAt));

      for (const sig of latestSignals) {
        if (!signalMap.has(sig.incidentId)) {
          signalMap.set(sig.incidentId, sig);
        }
      }
    }

    const incidents: IncidentListItem[] = rows.map((row) => {
      const base = mapIncidentRow(row);
      const latestSig = signalMap.get(row.id);
      return {
        ...base,
        latestSignalSummary: latestSig
          ? {
              httpMethod: latestSig.httpMethod,
              httpStatus: latestSig.httpStatus ?? null,
              durationMs: latestSig.durationMs,
              failureCategory: latestSig.failureCategory as FailureCategory,
            }
          : null,
      };
    });

    return { incidents, totalCount };
  } finally {
    await client.end();
  }
}

export async function readStoredIncident(
  connectionString: string,
  incidentId: string,
): Promise<IncidentDetail | null> {
  const client = createPostgresClient(connectionString);
  const db = drizzle(client);

  try {
    const [incidentRow] = await db
      .select()
      .from(incident)
      .where(eq(incident.id, incidentId))
      .limit(1);

    if (!incidentRow) return null;

    const signalRows = await db
      .select()
      .from(signal)
      .where(eq(signal.incidentId, incidentId))
      .orderBy(desc(signal.occurredAt))
      .limit(50);

    const eventRows = await db
      .select()
      .from(incidentEvent)
      .where(eq(incidentEvent.incidentId, incidentId))
      .orderBy(incidentEvent.createdAt);

    // Correlate associated workflow runs
    // 1. Direct runId links from signals
    const directRunIds = Array.from(
      new Set(signalRows.map((s) => s.runId).filter((id): id is string => Boolean(id))),
    );

    const correlatedRunMap = new Map<string, CorrelatedRunSummary>();

    if (directRunIds.length > 0) {
      const directRuns = await db
        .select()
        .from(journeyRun)
        .where(inArray(journeyRun.id, directRunIds));

      for (const r of directRuns) {
        correlatedRunMap.set(r.id, {
          runId: r.id,
          journeyId: r.journeyId,
          versionNumber: r.versionNumber,
          ownerId: r.ownerId,
          currentStepId: r.currentStepId,
          status: r.status,
          updatedAt: r.updatedAt.toISOString(),
        });
      }
    }

    // 2. Correlate by signalKey if present
    if (incidentRow.signalKey) {
      const targetSignalKey = incidentRow.signalKey;

      // Query paused runs
      const pausedRuns = await db
        .select({
          run: journeyRun,
          version: journeyVersion,
        })
        .from(journeyRun)
        .innerJoin(journeyVersion, eq(journeyRun.journeyVersionId, journeyVersion.id))
        .where(eq(journeyRun.status, "paused"))
        .limit(20);

      for (const { run: r, version: v } of pausedRuns) {
        if (correlatedRunMap.has(r.id)) continue;

        // Check if currentStepId in version steps matches targetSignalKey
        const steps = Array.isArray(v.steps) ? v.steps : [];
        const currentStep = steps.find(
          (s: unknown) =>
            typeof s === "object" && s !== null && "id" in s && (s as { id: string }).id === r.currentStepId,
        ) as { id: string; type?: string; signalKey?: string } | undefined;

        if (currentStep?.signalKey === targetSignalKey) {
          correlatedRunMap.set(r.id, {
            runId: r.id,
            journeyId: r.journeyId,
            versionNumber: r.versionNumber,
            ownerId: r.ownerId,
            currentStepId: r.currentStepId,
            status: r.status,
            updatedAt: r.updatedAt.toISOString(),
          });
        }
      }
    }

    return {
      incident: mapIncidentRow(incidentRow),
      signals: signalRows.map(mapSignalRow),
      events: eventRows.map(mapIncidentEventRow),
      associatedRuns: Array.from(correlatedRunMap.values()),
    };
  } finally {
    await client.end();
  }
}

export async function acknowledgeStoredIncident(
  connectionString: string,
  input: {
    incidentId: string;
    actorId: string;
    notes?: string;
  },
): Promise<IncidentRecord | null> {
  const client = createPostgresClient(connectionString);
  const db = drizzle(client);

  try {
    return await db.transaction(async (tx: Database) => {
      const [existing] = await tx
        .select()
        .from(incident)
        .where(eq(incident.id, input.incidentId))
        .limit(1);

      if (!existing) return null;
      if (existing.status === "resolved") return null;

      const now = new Date();

      await tx
        .update(incident)
        .set({
          status: "acknowledged",
          acknowledgedAt: now,
          acknowledgedBy: input.actorId,
        })
        .where(eq(incident.id, input.incidentId));

      await tx.insert(incidentEvent).values({
        id: randomUUID(),
        incidentId: input.incidentId,
        eventType: "incident_acknowledged",
        actorId: input.actorId,
        notes: input.notes ?? "Incident acknowledged by operator",
        createdAt: now,
      });

      const [updated] = await tx
        .select()
        .from(incident)
        .where(eq(incident.id, input.incidentId))
        .limit(1);

      return updated ? mapIncidentRow(updated) : null;
    });
  } finally {
    await client.end();
  }
}

export async function resolveStoredIncident(
  connectionString: string,
  input: {
    incidentId: string;
    actorId: string;
    resolutionNote: string;
  },
): Promise<IncidentRecord | null> {
  const client = createPostgresClient(connectionString);
  const db = drizzle(client);

  try {
    return await db.transaction(async (tx: Database) => {
      const [existing] = await tx
        .select()
        .from(incident)
        .where(eq(incident.id, input.incidentId))
        .limit(1);

      if (!existing) return null;

      const now = new Date();

      await tx
        .update(incident)
        .set({
          status: "resolved",
          resolvedAt: now,
          resolvedBy: input.actorId,
          resolutionNote: input.resolutionNote,
        })
        .where(eq(incident.id, input.incidentId));

      await tx.insert(incidentEvent).values({
        id: randomUUID(),
        incidentId: input.incidentId,
        eventType: "incident_resolved",
        actorId: input.actorId,
        notes: `Resolved: ${input.resolutionNote}`,
        createdAt: now,
      });

      const [updated] = await tx
        .select()
        .from(incident)
        .where(eq(incident.id, input.incidentId))
        .limit(1);

      return updated ? mapIncidentRow(updated) : null;
    });
  } finally {
    await client.end();
  }
}
