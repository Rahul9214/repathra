import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { seedJourneyTemplates } from "@/platform/journeys/seed-templates";
import {
  commitStepTransition,
  listStoredRuns,
  readStoredRun,
  startStoredRun,
} from "@/platform/runs/repository";
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

describe("resume anywhere repository integration", () => {
  it.skipIf(!databaseUrl)(
    "persists runs, enforces optimistic revisions, owner isolation, idempotency, and wait pauses",
    async () => {
      const connectionString = databaseUrl as string;

      // Ensure sandbox templates (vendor-onboarding) exist
      const seeded = await seedJourneyTemplates(connectionString);
      expect(seeded.ok).toBe(true);

      const ownerAlpha = `user-alpha-${randomUUID().slice(0, 8)}`;
      const ownerBeta = `user-beta-${randomUUID().slice(0, 8)}`;
      const idempotencyStartKey = `idem-start-${randomUUID()}`;

      // 1. Start a run for ownerAlpha
      const startResult = await startStoredRun(connectionString, {
        journeySlug: "vendor-onboarding",
        versionNumber: 1,
        ownerId: ownerAlpha,
        idempotencyKey: idempotencyStartKey,
        now: new Date(),
      });

      expect(startResult.ok).toBe(true);
      if (!startResult.ok) return;

      const run = startResult.run;
      expect(run.ownerId).toBe(ownerAlpha);
      expect(run.versionNumber).toBe(1);
      expect(run.status).toBe("active");
      expect(run.revision).toBe(1);
      expect(run.currentStepId).toBe("collect-legal-name");

      // 2. Start idempotency: same key returns the existing run with replayed: true
      const replayStart = await startStoredRun(connectionString, {
        journeySlug: "vendor-onboarding",
        versionNumber: 1,
        ownerId: ownerAlpha,
        idempotencyKey: idempotencyStartKey,
        now: new Date(),
      });
      expect(replayStart.ok).toBe(true);
      if (replayStart.ok) {
        expect(replayStart.run.id).toBe(run.id);
        expect(replayStart.replayed).toBe(true);
      }

      // 3. Owner beta cannot read owner alpha's run
      const betaRead = await readStoredRun(connectionString, {
        runId: run.id,
        ownerId: ownerBeta,
      });
      expect(betaRead.ok).toBe(false);
      if (!betaRead.ok) {
        expect(betaRead.code).toBe("unauthorized");
      }

      // 4. Owner beta's list does not contain owner alpha's run
      const betaList = await listStoredRuns(connectionString, { ownerId: ownerBeta });
      expect(betaList.ok).toBe(true);
      if (betaList.ok) {
        expect(betaList.runs.some((r) => r.id === run.id)).toBe(false);
      }

      // 5. Owner alpha can read their own run detail
      const alphaRead = await readStoredRun(connectionString, {
        runId: run.id,
        ownerId: ownerAlpha,
      });
      expect(alphaRead.ok).toBe(true);
      if (alphaRead.ok) {
        expect(alphaRead.detail.run.id).toBe(run.id);
        expect(alphaRead.detail.currentStep.id).toBe("collect-legal-name");
        expect(alphaRead.detail.events.length).toBe(1);
        expect(alphaRead.detail.events[0]?.eventType).toBe("run_started");
      }

      // 6. Step transition 1: collect legal name -> moves to collect-contact
      const step1IdemKey = `idem-step1-${randomUUID()}`;
      const step1 = await commitStepTransition(connectionString, {
        runId: run.id,
        ownerId: ownerAlpha,
        expectedRevision: 1,
        action: { type: "collect", value: "Alpha Global Logistics" },
        idempotencyKey: step1IdemKey,
        now: new Date(),
      });

      expect(step1.ok).toBe(true);
      if (!step1.ok) return;
      expect(step1.run.revision).toBe(2);
      expect(step1.run.currentStepId).toBe("collect-contact");
      expect(step1.run.collectedValues).toEqual({ legal_name: "Alpha Global Logistics" });
      expect(step1.run.completedStepIds).toEqual(["collect-legal-name"]);

      // 7. Stale revision check: attempting to apply with revision 1 when revision is 2 fails with revision_conflict
      const staleAttempt = await commitStepTransition(connectionString, {
        runId: run.id,
        ownerId: ownerAlpha,
        expectedRevision: 1,
        action: { type: "collect", value: "ops@alpha.test" },
        now: new Date(),
      });
      expect(staleAttempt.ok).toBe(false);
      if (!staleAttempt.ok) {
        expect(staleAttempt.code).toBe("revision_conflict");
      }

      // 8. Idempotent step transition: replay step 1 with same key returns current state without re-incrementing
      const replayStep1 = await commitStepTransition(connectionString, {
        runId: run.id,
        ownerId: ownerAlpha,
        expectedRevision: 1,
        action: { type: "collect", value: "Alpha Global Logistics" },
        idempotencyKey: step1IdemKey,
        now: new Date(),
      });
      expect(replayStep1.ok).toBe(true);
      if (replayStep1.ok) {
        expect(replayStep1.replayed).toBe(true);
        expect(replayStep1.run.revision).toBe(2);
      }

      // 9. Owner beta cannot mutate owner alpha's run
      const betaMutate = await commitStepTransition(connectionString, {
        runId: run.id,
        ownerId: ownerBeta,
        expectedRevision: 2,
        action: { type: "collect", value: "bad@beta.test" },
        now: new Date(),
      });
      expect(betaMutate.ok).toBe(false);
      if (!betaMutate.ok) {
        expect(betaMutate.code).toBe("unauthorized");
      }

      // 10. Step transition 2: collect contact email -> moves to review-profile
      const step2 = await commitStepTransition(connectionString, {
        runId: run.id,
        ownerId: ownerAlpha,
        expectedRevision: 2,
        action: { type: "collect", value: "contact@alpha.test" },
        now: new Date(),
      });
      expect(step2.ok).toBe(true);
      if (!step2.ok) return;
      expect(step2.run.revision).toBe(3);
      expect(step2.run.currentStepId).toBe("review-profile");
      expect(step2.run.collectedValues).toEqual({
        legal_name: "Alpha Global Logistics",
        contact_email: "contact@alpha.test",
      });

      // 11. Step transition 3: review acknowledged -> moves to decide-risk
      const step3 = await commitStepTransition(connectionString, {
        runId: run.id,
        ownerId: ownerAlpha,
        expectedRevision: 3,
        action: { type: "review", acknowledged: true },
        now: new Date(),
      });
      expect(step3.ok).toBe(true);
      if (!step3.ok) return;
      expect(step3.run.revision).toBe(4);
      expect(step3.run.currentStepId).toBe("decide-risk");

      // 12. Step transition 4: decision -> select "enhanced" sample -> targets wait-registry
      const step4 = await commitStepTransition(connectionString, {
        runId: run.id,
        ownerId: ownerAlpha,
        expectedRevision: 4,
        action: { type: "decide", outcomeId: "enhanced" },
        now: new Date(),
      });
      expect(step4.ok).toBe(true);
      if (!step4.ok) return;
      expect(step4.run.revision).toBe(5);
      expect(step4.run.currentStepId).toBe("wait-registry");
      expect(step4.run.status).toBe("paused");

      // 13. Wait step cannot be bypassed manually
      const bypassWait = await commitStepTransition(connectionString, {
        runId: run.id,
        ownerId: ownerAlpha,
        expectedRevision: 5,
        action: { type: "review", acknowledged: true },
        now: new Date(),
      });
      expect(bypassWait.ok).toBe(false);
      if (!bypassWait.ok) {
        expect(bypassWait.code).toBe("step_paused_waiting_for_signal");
      }

      // 14. Verify full event history
      const history = await readStoredRun(connectionString, {
        runId: run.id,
        ownerId: ownerAlpha,
      });
      expect(history.ok).toBe(true);
      if (history.ok) {
        expect(history.detail.events.length).toBe(5); // run_started, step_transitioned x 3, run_paused
        expect(history.detail.events[0]?.eventType).toBe("run_started");
        expect(history.detail.events[1]?.eventType).toBe("step_transitioned");
        expect(history.detail.events[2]?.eventType).toBe("step_transitioned");
        expect(history.detail.events[3]?.eventType).toBe("step_transitioned");
        expect(history.detail.events[4]?.eventType).toBe("run_paused");
      }

      // 15. User list shows the active/paused run with step progress
      const finalList = await listStoredRuns(connectionString, { ownerId: ownerAlpha });
      expect(finalList.ok).toBe(true);
      if (finalList.ok) {
        const found = finalList.runs.find((r) => r.id === run.id);
        expect(found).toBeDefined();
        expect(found?.status).toBe("paused");
        expect(found?.completedStepCount).toBe(4);
        expect(found?.totalStepCount).toBe(9);
      }

      // Cleanup test run to keep database clean
      const client = createPostgresClient(connectionString);
      try {
        await client`delete from journey_run where id = ${run.id}`;
      } finally {
        await client.end({ timeout: 5 }).catch(() => undefined);
      }
    },
    30_000,
  );
});
