import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { journeyContentHash } from "@/features/journey-studio/hash";
import { SANDBOX_NOTICE, SANDBOX_TEMPLATES } from "@/features/journey-studio/templates";
import { createPostgresClient } from "@/shared/db/connection";
import { seedJourneyTemplates } from "@/platform/journeys/seed-templates";
import { readStoredJourney } from "@/platform/journeys/repository";
import { readJourney } from "@/platform/journeys/live";
import { journeyDetailResponse } from "@/platform/journeys/http";

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

describe("journey studio database", () => {
  it.skipIf(!databaseUrl)(
    "seeds sandbox journeys and rejects mutation of a published version",
    async () => {
    const connectionString = databaseUrl as string;
    const seeded = await seedJourneyTemplates(connectionString);
    expect(seeded.ok).toBe(true);
    if (!seeded.ok) return;
    const again = await seedJourneyTemplates(connectionString);
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.versionsInserted).toBe(0);

    for (const template of SANDBOX_TEMPLATES) {
      const stored = await readStoredJourney(connectionString, template.slug);
      expect(stored.ok).toBe(true);
      if (!stored.ok) return;
      expect(stored.journey.origin).toBe("sandbox");
      expect(stored.journey.sandboxNotice).toBe(SANDBOX_NOTICE);
      expect(stored.journey.versions[0]?.contentHash).toBe(journeyContentHash(template.document));
      expect(stored.journey.versions[0]?.versionNumber).toBe(1);
    }

    const client = createPostgresClient(connectionString);
    const slug = `immutability-${randomUUID().slice(0, 8)}`;
    const definitionId = randomUUID();
    const versionId = randomUUID();
    try {
      await expect(
        client.begin(async (sql) => {
          await sql`
            insert into journey_definition (
              id, slug, origin, title, summary, created_by
            ) values (
              ${definitionId}, ${slug}, 'operator', 'Immutability probe', 'A transaction that must roll back.', 'test'
            )
          `;
          await sql`
            insert into journey_version (
              id, journey_id, version_number, title, summary, entry_step_id, steps, content_hash, published_by
            ) values (
              ${versionId},
              ${definitionId},
              1,
              'Immutability probe',
              'A transaction that must roll back.',
              'complete-recorded',
              ${sql.json([{ id: "complete-recorded", type: "complete", title: "Done", instruction: "Done", outcome: "accepted", next: null }])},
              ${"a".repeat(64)},
              'test'
            )
          `;
          await sql`update journey_version set title = 'rewritten' where id = ${versionId}`;
        }),
      ).rejects.toThrow(/immutable/);
    } finally {
      await client.end({ timeout: 5 }).catch(() => undefined);
    }

    const leftover = await readStoredJourney(connectionString, slug);
    expect(leftover.ok).toBe(false);

    const readUnauthenticated = await readJourney("vendor-onboarding");
    expect(readUnauthenticated.ok).toBe(true);
    if (readUnauthenticated.ok) {
      expect(readUnauthenticated.draftAccess).not.toBe("allowed");
      expect(readUnauthenticated.journey.draft).toBeNull();
      expect(readUnauthenticated.journey.versions.length).toBeGreaterThan(0);
      expect(readUnauthenticated.journey.versions[0]?.document.steps.length).toBeGreaterThan(0);
    }

    const response = await journeyDetailResponse("vendor-onboarding");
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      ok: boolean;
      draftAccess: string;
      journey: { draft: unknown; versions: unknown[] };
    };
    expect(body.ok).toBe(true);
    expect(body.draftAccess).not.toBe("allowed");
    expect(body.journey.draft).toBeNull();
    expect(body.journey.versions.length).toBeGreaterThan(0);
    },
    30_000,
  );
});
