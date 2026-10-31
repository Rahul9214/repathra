import { randomUUID } from "node:crypto";

import { and, desc, eq } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";

import type { CompleteOutcome, JourneyDocument } from "@/features/journey-studio/model";
import { validateJourney } from "@/features/journey-studio/validate";
import { evaluateTransition, getInitialRunState } from "@/features/resume-anywhere/engine";
import { RUN_MESSAGES } from "@/features/resume-anywhere/messages";
import type {
  RunDetail,
  RunEventRecord,
  RunListItem,
  RunRecord,
  StepAction,
} from "@/features/resume-anywhere/model";
import { createPostgresClient } from "@/shared/db/connection";
import { journeyDefinition, journeyVersion } from "@/shared/db/journey-schema";
import { journeyRun, journeyRunEvent } from "@/shared/db/run-schema";

type Database = PostgresJsDatabase;

export type RunRepositoryFailure = {
  ok: false;
  code:
    | "not_found"
    | "version_not_found"
    | "run_not_found"
    | "unauthorized"
    | "revision_conflict"
    | "run_already_completed"
    | "step_paused_waiting_for_signal"
    | "step_paused_waiting_for_handoff"
    | "invalid_step_type"
    | "missing_required_field"
    | "review_acknowledgment_required"
    | "invalid_decision_outcome"
    | "current_step_not_found"
    | "next_step_not_found"
    | "stored_journey_invalid";
  message?: string;
};

class RunStoreSignal extends Error {
  constructor(
    readonly storeCode: RunRepositoryFailure["code"],
    readonly customMessage?: string,
  ) {
    super(storeCode);
  }
}

export async function startStoredRun(
  connectionString: string,
  input: {
    journeySlug: string;
    versionNumber: number;
    ownerId: string;
    idempotencyKey?: string;
    now: Date;
  },
): Promise<{ ok: true; run: RunRecord; replayed?: boolean } | RunRepositoryFailure> {
  return withStore(connectionString, async (db) => {
    try {
      return await db.transaction(async (tx) => {
        const definitions = await tx
          .select()
          .from(journeyDefinition)
          .where(eq(journeyDefinition.slug, input.journeySlug));
        const definition = definitions[0];
        if (!definition) throw new RunStoreSignal("not_found");

        const versions = await tx
          .select()
          .from(journeyVersion)
          .where(
            and(
              eq(journeyVersion.journeyId, definition.id),
              eq(journeyVersion.versionNumber, input.versionNumber),
            ),
          );
        const version = versions[0];
        if (!version) throw new RunStoreSignal("version_not_found");

        const document = documentFromColumns(version);

        if (input.idempotencyKey) {
          const existingEvents = await tx
            .select()
            .from(journeyRunEvent)
            .where(
              and(
                eq(journeyRunEvent.actorId, input.ownerId),
                eq(journeyRunEvent.idempotencyKey, input.idempotencyKey),
                eq(journeyRunEvent.eventType, "run_started"),
              ),
            );
          if (existingEvents.length > 0) {
            const replayedRun = await loadRunRecord(tx, existingEvents[0]!.runId, input.ownerId);
            if (replayedRun) {
              return { ok: true as const, run: replayedRun, replayed: true };
            }
          }
        }

        const initial = getInitialRunState(document);
        const runId = randomUUID();

        await tx.insert(journeyRun).values({
          id: runId,
          journeyId: definition.id,
          journeyVersionId: version.id,
          versionNumber: version.versionNumber,
          contentHash: version.contentHash,
          ownerId: input.ownerId,
          currentStepId: initial.currentStepId,
          status: initial.status,
          revision: 1,
          collectedValues: {},
          completedStepIds: [],
          completedOutcome: initial.completedOutcome,
          createdAt: input.now,
          updatedAt: input.now,
          completedAt: initial.status === "completed" ? input.now : null,
        });

        await tx.insert(journeyRunEvent).values({
          id: randomUUID(),
          runId,
          sequenceNumber: 1,
          eventType: "run_started",
          fromStepId: null,
          toStepId: initial.currentStepId,
          action: { type: "start", versionNumber: version.versionNumber },
          idempotencyKey: input.idempotencyKey ?? null,
          actorId: input.ownerId,
          createdAt: input.now,
        });

        const createdRun = await loadRunRecord(tx, runId, input.ownerId);
        if (!createdRun) throw new RunStoreSignal("stored_journey_invalid");
        return { ok: true as const, run: createdRun };
      });
    } catch (error) {
      const signal = signalFailure(error);
      if (signal) return signal;
      throw error;
    }
  });
}

export async function listStoredRuns(
  connectionString: string,
  input: { ownerId: string },
): Promise<{ ok: true; runs: RunListItem[] } | RunRepositoryFailure> {
  return withStore(connectionString, async (db) => {
    const rows = await db
      .select({
        run: journeyRun,
        definition: journeyDefinition,
        version: journeyVersion,
      })
      .from(journeyRun)
      .innerJoin(journeyDefinition, eq(journeyRun.journeyId, journeyDefinition.id))
      .innerJoin(journeyVersion, eq(journeyRun.journeyVersionId, journeyVersion.id))
      .where(eq(journeyRun.ownerId, input.ownerId))
      .orderBy(desc(journeyRun.updatedAt));

    const runs: RunListItem[] = rows.map(({ run, definition, version }) => {
      let currentStepTitle = run.currentStepId;
      let totalStepCount = 0;
      try {
        const doc = documentFromColumns(version);
        totalStepCount = doc.steps.length;
        const currentStep = doc.steps.find((s) => s.id === run.currentStepId);
        if (currentStep) currentStepTitle = currentStep.title;
      } catch {
        // fallback to step id
      }

      const completedIds = Array.isArray(run.completedStepIds) ? (run.completedStepIds as string[]) : [];

      return {
        id: run.id,
        journeySlug: definition.slug,
        journeyTitle: definition.title,
        journeyOrigin: definition.origin,
        sandboxNotice: definition.sandboxNotice,
        versionNumber: run.versionNumber,
        currentStepId: run.currentStepId,
        currentStepTitle,
        status: run.status,
        revision: run.revision,
        completedStepCount: completedIds.length,
        totalStepCount,
        completedOutcome: run.completedOutcome as CompleteOutcome | null,
        createdAt: run.createdAt.toISOString(),
        updatedAt: run.updatedAt.toISOString(),
        completedAt: run.completedAt?.toISOString() ?? null,
      };
    });

    return { ok: true, runs };
  });
}

export async function readStoredRun(
  connectionString: string,
  input: { runId: string; ownerId: string },
): Promise<{ ok: true; detail: RunDetail } | RunRepositoryFailure> {
  return withStore(connectionString, async (db) => {
    const rows = await db
      .select({
        run: journeyRun,
        definition: journeyDefinition,
        version: journeyVersion,
      })
      .from(journeyRun)
      .innerJoin(journeyDefinition, eq(journeyRun.journeyId, journeyDefinition.id))
      .innerJoin(journeyVersion, eq(journeyRun.journeyVersionId, journeyVersion.id))
      .where(eq(journeyRun.id, input.runId));

    const row = rows[0];
    if (!row) return { ok: false, code: "run_not_found" };

    if (row.run.ownerId !== input.ownerId) {
      return { ok: false, code: "unauthorized" };
    }

    const document = documentFromColumns(row.version);
    const currentStep = document.steps.find((s) => s.id === row.run.currentStepId);
    if (!currentStep) return { ok: false, code: "stored_journey_invalid" };

    const events = await db
      .select()
      .from(journeyRunEvent)
      .where(eq(journeyRunEvent.runId, row.run.id))
      .orderBy(journeyRunEvent.sequenceNumber);

    const eventRecords: RunEventRecord[] = events.map((e) => ({
      id: e.id,
      runId: e.runId,
      sequenceNumber: e.sequenceNumber,
      eventType: e.eventType,
      fromStepId: e.fromStepId,
      toStepId: e.toStepId,
      action: e.action,
      idempotencyKey: e.idempotencyKey,
      actorId: e.actorId,
      createdAt: e.createdAt.toISOString(),
    }));

    const runRecord: RunRecord = {
      id: row.run.id,
      journeyId: row.definition.id,
      journeySlug: row.definition.slug,
      journeyTitle: row.definition.title,
      journeyOrigin: row.definition.origin,
      sandboxNotice: row.definition.sandboxNotice,
      journeyVersionId: row.version.id,
      versionNumber: row.run.versionNumber,
      contentHash: row.run.contentHash,
      ownerId: row.run.ownerId,
      currentStepId: row.run.currentStepId,
      status: row.run.status,
      revision: row.run.revision,
      collectedValues: (row.run.collectedValues ?? {}) as Record<string, string>,
      completedStepIds: (row.run.completedStepIds ?? []) as string[],
      completedOutcome: row.run.completedOutcome as CompleteOutcome | null,
      createdAt: row.run.createdAt.toISOString(),
      updatedAt: row.run.updatedAt.toISOString(),
      completedAt: row.run.completedAt?.toISOString() ?? null,
    };

    return {
      ok: true,
      detail: {
        run: runRecord,
        document,
        currentStep,
        events: eventRecords,
        isOwner: true,
      },
    };
  });
}

export async function commitStepTransition(
  connectionString: string,
  input: {
    runId: string;
    ownerId: string;
    expectedRevision: number;
    action: StepAction;
    idempotencyKey?: string;
    now: Date;
  },
): Promise<{ ok: true; run: RunRecord; replayed?: boolean } | RunRepositoryFailure> {
  return withStore(connectionString, async (db) => {
    try {
      return await db.transaction(async (tx) => {
        if (input.idempotencyKey) {
          const existingEvents = await tx
            .select()
            .from(journeyRunEvent)
            .where(
              and(
                eq(journeyRunEvent.runId, input.runId),
                eq(journeyRunEvent.idempotencyKey, input.idempotencyKey),
              ),
            );
          if (existingEvents.length > 0) {
            const replayedRun = await loadRunRecord(tx, input.runId, input.ownerId);
            if (replayedRun) {
              return { ok: true as const, run: replayedRun, replayed: true };
            }
          }
        }

        const runRows = await tx
          .select()
          .from(journeyRun)
          .where(eq(journeyRun.id, input.runId));
        const run = runRows[0];
        if (!run) throw new RunStoreSignal("run_not_found");

        if (run.ownerId !== input.ownerId) {
          throw new RunStoreSignal("unauthorized");
        }

        if (run.status === "completed") {
          throw new RunStoreSignal("run_already_completed", RUN_MESSAGES.run_already_completed);
        }

        if (run.revision !== input.expectedRevision) {
          throw new RunStoreSignal("revision_conflict", RUN_MESSAGES.revision_conflict);
        }

        const versionRows = await tx
          .select()
          .from(journeyVersion)
          .where(eq(journeyVersion.id, run.journeyVersionId));
        const version = versionRows[0];
        if (!version) throw new RunStoreSignal("version_not_found");

        const document = documentFromColumns(version);

        const transition = evaluateTransition({
          document,
          currentStepId: run.currentStepId,
          status: run.status,
          collectedValues: (run.collectedValues ?? {}) as Record<string, string>,
          completedStepIds: (run.completedStepIds ?? []) as string[],
          action: input.action,
        });

        if (!transition.ok) {
          throw new RunStoreSignal(transition.code as RunRepositoryFailure["code"], transition.message);
        }

        const updated = await tx
          .update(journeyRun)
          .set({
            currentStepId: transition.nextStepId,
            status: transition.nextStatus,
            revision: input.expectedRevision + 1,
            collectedValues: transition.collectedValues,
            completedStepIds: transition.completedStepIds,
            completedOutcome: transition.completedOutcome,
            completedAt: transition.nextStatus === "completed" ? input.now : null,
            updatedAt: input.now,
          })
          .where(
            and(
              eq(journeyRun.id, input.runId),
              eq(journeyRun.revision, input.expectedRevision),
            ),
          )
          .returning({ id: journeyRun.id });

        if (updated.length !== 1) {
          throw new RunStoreSignal("revision_conflict", RUN_MESSAGES.revision_conflict);
        }

        const seqEvents = await tx
          .select({ seq: journeyRunEvent.sequenceNumber })
          .from(journeyRunEvent)
          .where(eq(journeyRunEvent.runId, input.runId))
          .orderBy(desc(journeyRunEvent.sequenceNumber))
          .limit(1);

        const nextSequence = (seqEvents[0]?.seq ?? 0) + 1;

        await tx.insert(journeyRunEvent).values({
          id: randomUUID(),
          runId: input.runId,
          sequenceNumber: nextSequence,
          eventType:
            transition.nextStatus === "completed"
              ? "run_completed"
              : transition.nextStatus === "paused"
                ? "run_paused"
                : "step_transitioned",
          fromStepId: run.currentStepId,
          toStepId: transition.nextStepId,
          action: input.action,
          idempotencyKey: input.idempotencyKey ?? null,
          actorId: input.ownerId,
          createdAt: input.now,
        });

        const updatedRun = await loadRunRecord(tx, input.runId, input.ownerId);
        if (!updatedRun) throw new RunStoreSignal("stored_journey_invalid");
        return { ok: true as const, run: updatedRun };
      });
    } catch (error) {
      const signal = signalFailure(error);
      if (signal) return signal;
      throw error;
    }
  });
}

async function loadRunRecord(
  db: Database,
  runId: string,
  ownerId: string,
): Promise<RunRecord | null> {
  const rows = await db
    .select({
      run: journeyRun,
      definition: journeyDefinition,
      version: journeyVersion,
    })
    .from(journeyRun)
    .innerJoin(journeyDefinition, eq(journeyRun.journeyId, journeyDefinition.id))
    .innerJoin(journeyVersion, eq(journeyRun.journeyVersionId, journeyVersion.id))
    .where(and(eq(journeyRun.id, runId), eq(journeyRun.ownerId, ownerId)));

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.run.id,
    journeyId: row.definition.id,
    journeySlug: row.definition.slug,
    journeyTitle: row.definition.title,
    journeyOrigin: row.definition.origin,
    sandboxNotice: row.definition.sandboxNotice,
    journeyVersionId: row.version.id,
    versionNumber: row.run.versionNumber,
    contentHash: row.run.contentHash,
    ownerId: row.run.ownerId,
    currentStepId: row.run.currentStepId,
    status: row.run.status,
    revision: row.run.revision,
    collectedValues: (row.run.collectedValues ?? {}) as Record<string, string>,
    completedStepIds: (row.run.completedStepIds ?? []) as string[],
    completedOutcome: row.run.completedOutcome as CompleteOutcome | null,
    createdAt: row.run.createdAt.toISOString(),
    updatedAt: row.run.updatedAt.toISOString(),
    completedAt: row.run.completedAt?.toISOString() ?? null,
  };
}

function documentFromColumns(row: {
  title: string;
  summary: string;
  entryStepId: string;
  steps: unknown;
}): JourneyDocument {
  const validated = validateJourney({
    title: row.title,
    summary: row.summary,
    entryStepId: row.entryStepId,
    steps: row.steps,
  });
  if (!validated.ok) throw new RunStoreSignal("stored_journey_invalid");
  return validated.document;
}

async function withStore<T>(connectionString: string, run: (db: Database) => Promise<T>): Promise<T> {
  const client = createPostgresClient(connectionString);
  try {
    return await run(drizzle(client));
  } finally {
    await client.end({ timeout: 5 }).catch(() => undefined);
  }
}

function signalFailure(error: unknown): RunRepositoryFailure | null {
  if (error instanceof RunStoreSignal) {
    return {
      ok: false,
      code: error.storeCode,
      message: error.customMessage,
    };
  }
  return null;
}
