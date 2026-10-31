import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { seedJourneyTemplates } from "@/platform/journeys/seed-templates";
import {
  commitStepTransition,
  readStoredRun,
  startStoredRun,
} from "@/platform/runs/repository";
import {
  acknowledgeStoredIncident,
  listStoredIncidents,
  readStoredIncident,
  recordSignal,
  resolveStoredIncident,
} from "@/platform/signals/repository";
import { createPostgresClient } from "@/shared/db/connection";

function developmentDatabaseUrl(): string | undefined {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const file = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(file)) return undefined;
  const text = fs.readFileSync(file, "utf8");
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith("DATABASE_URL=")) continue;
    let value = line.slice("DATABASE_URL=".length).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    return value || undefined;
  }
  return undefined;
}

const databaseUrl = developmentDatabaseUrl();
if (databaseUrl && !process.env.DATABASE_URL) {
  process.env.DATABASE_URL = databaseUrl;
}

describe("live signal inbox repository integration", () => {
  it.skipIf(!databaseUrl)(
    "persists signals, correlates incidents deterministically, deduplicates on idempotency, executes operator lifecycle, and correlates workflow runs without auto-advancing them",
    async () => {
      const connectionString = databaseUrl as string;

      // 0. Database Safety Gate Verification
      const client = createPostgresClient(connectionString);
      try {
        const [row] = await client`SELECT inet_server_addr() as addr, current_database() as db;`;
        expect(row?.db).toBe("neondb");
        // Verify host does NOT contain production endpoint
        expect(connectionString).not.toContain("ep-restless-grass-aow8ekge");
        expect(connectionString).toContain("ep-dry-queen-aok0vzxe");
      } finally {
        await client.end();
      }

      // Ensure templates exist for workflow run testing
      await seedJourneyTemplates(connectionString);

      const uniquePrefix = `test-${randomUUID().slice(0, 8)}`;
      const source = `partner-registry-${uniquePrefix}`;
      const operation = "verify-credentials";
      const signalKey = "vendor-registry";

      let incidentId: string | undefined;
      let runId: string | undefined;

      try {
        // 1. Ingest first signal -> creates new Incident with diagnostic provenance
        const signal1 = await recordSignal(connectionString, {
          provenance: "diagnostic",
          source,
          operation,
          signalKey,
          failureCategory: "http_5xx",
          telemetry: {
            method: "POST",
            url: `https://${source}.io/api/verify`,
            status: 503,
            durationMs: 1420,
            requestHeaders: { "content-type": "application/json" },
            responseHeaders: { "retry-after": "60" },
          },
          correlationId: `corr-${randomUUID().slice(0, 8)}`,
          idempotencyKey: `idem-${uniquePrefix}-1`,
          occurredAt: new Date().toISOString(),
        });

        expect(signal1.ok).toBe(true);
        if (!signal1.ok) return;

        expect(signal1.isNewIncident).toBe(true);
        expect(signal1.replayed).toBe(false);
        expect(signal1.incident.status).toBe("open");
        expect(signal1.incident.occurrenceCount).toBe(1);
        expect(signal1.incident.source).toBe(source);
        expect(signal1.incident.signalKey).toBe(signalKey);
        expect(signal1.signal.httpStatus).toBe(503);
        expect(signal1.signal.provenance).toBe("diagnostic");

        incidentId = signal1.incident.id;

        // 2. Ingest duplicate signal with same idempotencyKey -> replayed: true, no count increment
        const replay = await recordSignal(connectionString, {
          provenance: "diagnostic",
          source,
          operation,
          signalKey,
          failureCategory: "http_5xx",
          telemetry: {
            method: "POST",
            url: `https://${source}.io/api/verify`,
            status: 503,
            durationMs: 1420,
          },
          idempotencyKey: `idem-${uniquePrefix}-1`,
        });

        expect(replay.ok).toBe(true);
        if (!replay.ok) return;
        expect(replay.replayed).toBe(true);
        expect(replay.incident.occurrenceCount).toBe(1);

        // 3. Ingest second distinct signal for the SAME source & operation -> Correlates into existing incident
        const signal2 = await recordSignal(connectionString, {
          provenance: "diagnostic",
          source,
          operation,
          signalKey,
          failureCategory: "http_5xx",
          telemetry: {
            method: "POST",
            url: `https://${source}.io/api/verify`,
            status: 500,
            durationMs: 890,
          },
          idempotencyKey: `idem-${uniquePrefix}-2`,
          occurredAt: new Date().toISOString(),
        });

        expect(signal2.ok).toBe(true);
        if (!signal2.ok) return;
        expect(signal2.isNewIncident).toBe(false);
        expect(signal2.replayed).toBe(false);
        expect(signal2.incident.id).toBe(incidentId);
        expect(signal2.incident.occurrenceCount).toBe(2);

        // 4. Operator Acknowledge Lifecycle
        const operatorId = "user_operator_alpha";
        const ackResult = await acknowledgeStoredIncident(connectionString, {
          incidentId,
          actorId: operatorId,
          notes: "Investigating upstream outage with partner ops team",
        });

        expect(ackResult).not.toBeNull();
        expect(ackResult?.status).toBe("acknowledged");
        expect(ackResult?.acknowledgedBy).toBe(operatorId);
        expect(ackResult?.acknowledgedAt).not.toBeNull();

        // 5. Workflow Correlation & SAFEGUARD Verification
        // Create a paused run waiting on signalKey: "vendor-registry"
        const testOwner = `owner-${randomUUID().slice(0, 8)}`;
        const startRunRes = await startStoredRun(connectionString, {
          journeySlug: "vendor-onboarding",
          versionNumber: 1,
          ownerId: testOwner,
          now: new Date(),
        });
        expect(startRunRes.ok).toBe(true);
        if (!startRunRes.ok) return;

        runId = startRunRes.run.id;

        // Progress run to wait-registry
        await commitStepTransition(connectionString, {
          runId,
          ownerId: testOwner,
          expectedRevision: 1,
          action: { type: "collect", value: "Signal Test Corp" },
          now: new Date(),
        });
        await commitStepTransition(connectionString, {
          runId,
          ownerId: testOwner,
          expectedRevision: 2,
          action: { type: "collect", value: "ops@signaltest.com" },
          now: new Date(),
        });
        await commitStepTransition(connectionString, {
          runId,
          ownerId: testOwner,
          expectedRevision: 3,
          action: { type: "review", acknowledged: true },
          now: new Date(),
        });
        const pausedRes = await commitStepTransition(connectionString, {
          runId,
          ownerId: testOwner,
          expectedRevision: 4,
          action: { type: "decide", outcomeId: "enhanced" },
          now: new Date(),
        });

        expect(pausedRes.ok).toBe(true);
        if (!pausedRes.ok) return;
        expect(pausedRes.run.currentStepId).toBe("wait-registry");
        expect(pausedRes.run.status).toBe("paused");
        expect(pausedRes.run.revision).toBe(5);

        // Read incident detail: verify correlated runs includes this paused run
        const detail = await readStoredIncident(connectionString, incidentId);
        expect(detail).not.toBeNull();
        if (!detail) return;

        expect(detail.incident.id).toBe(incidentId);
        expect(detail.signals.length).toBe(2);
        expect(detail.signals[0]?.provenance).toBe("diagnostic");
        expect(detail.events.length).toBeGreaterThanOrEqual(3); // opened, attached, acknowledged

        const correlatedRun = detail.associatedRuns.find((r) => r.runId === runId);
        expect(correlatedRun).toBeDefined();
        expect(correlatedRun?.currentStepId).toBe("wait-registry");
        expect(correlatedRun?.status).toBe("paused");

        // CRITICAL SAFEGUARD: Verify that the run itself in the database was NOT auto-advanced!
        const verifyRun = await readStoredRun(connectionString, { runId, ownerId: testOwner });
        expect(verifyRun.ok).toBe(true);
        if (verifyRun.ok) {
          expect(verifyRun.detail.run.status).toBe("paused");
          expect(verifyRun.detail.run.currentStepId).toBe("wait-registry");
          expect(verifyRun.detail.run.revision).toBe(5); // Revision must NOT have changed
        }

        // 6. Operator Resolve Lifecycle
        const resolveResult = await resolveStoredIncident(connectionString, {
          incidentId,
          actorId: operatorId,
          resolutionNote: "Partner confirmed gateway reboot complete; latency restored to baseline.",
        });

        expect(resolveResult).not.toBeNull();
        expect(resolveResult?.status).toBe("resolved");
        expect(resolveResult?.resolvedBy).toBe(operatorId);
        expect(resolveResult?.resolutionNote).toContain("Partner confirmed gateway reboot");

        // 7. List and Filter Incidents
        const listOpen = await listStoredIncidents(connectionString, { status: "open" });
        expect(listOpen.incidents.every((i) => i.id !== incidentId)).toBe(true);

        const listResolved = await listStoredIncidents(connectionString, { status: "resolved", source });
        expect(listResolved.incidents.some((i) => i.id === incidentId)).toBe(true);
      } finally {
        // Strict Development Database Safeguards & Isolated Cleanup
        expect(connectionString).not.toContain("ep-restless-grass-aow8ekge");
        expect(connectionString).toContain("ep-dry-queen-aok0vzxe");

        const cleanupClient = createPostgresClient(connectionString);
        try {
          if (incidentId) {
            await cleanupClient`DELETE FROM signal WHERE incident_id = ${incidentId};`;
            await cleanupClient`DELETE FROM incident_event WHERE incident_id = ${incidentId};`;
            await cleanupClient`DELETE FROM incident WHERE id = ${incidentId};`;
          }
          if (runId) {
            await cleanupClient`DELETE FROM journey_run_event WHERE run_id = ${runId};`;
            await cleanupClient`DELETE FROM journey_run WHERE id = ${runId};`;
          }
        } finally {
          await cleanupClient.end();
        }
      }
    },
    60000,
  );
});
