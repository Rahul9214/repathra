import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";

import type { JourneyDocument, JourneyOrigin, TemplateKey } from "@/features/journey-studio/model";
import type { PublishCommitInput } from "@/features/journey-studio/service";
import { validateJourney } from "@/features/journey-studio/validate";
import { createPostgresClient } from "@/shared/db/connection";
import { journeyDefinition, journeyDraft, journeyVersion } from "@/shared/db/journey-schema";
import { readPgCode } from "@/shared/db/postgres-error";

type Database = PostgresJsDatabase;

export type StoredVersionSummary = {
  versionNumber: number;
  contentHash: string;
  publishedBy: string;
  publishedAt: string;
  title: string;
};

export type StoredJourneyListItem = {
  slug: string;
  title: string;
  summary: string;
  origin: JourneyOrigin;
  templateKey: TemplateKey | null;
  sandboxNotice: string | null;
  latestVersion: number | null;
  draftRevision: number | null;
};

export type StoredJourneyRecord = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  origin: JourneyOrigin;
  templateKey: TemplateKey | null;
  sandboxNotice: string | null;
  draft: {
    revision: number;
    basedOnVersion: number | null;
    updatedAt: string;
    document: JourneyDocument;
  } | null;
  versions: Array<
    StoredVersionSummary & {
      document: JourneyDocument;
    }
  >;
};

export type RepositoryFailure = {
  ok: false;
  code: "not_found" | "revision_conflict" | "unchanged_draft" | "slug_taken" | "stored_journey_invalid";
};

class StoreSignal extends Error {
  constructor(readonly storeCode: RepositoryFailure["code"]) {
    super(storeCode);
  }
}

export async function listStoredJourneys(
  connectionString: string,
): Promise<{ ok: true; journeys: StoredJourneyListItem[] } | RepositoryFailure> {
  return withStore(connectionString, async (db) => {
    const definitions = await db.select().from(journeyDefinition).orderBy(journeyDefinition.slug);
    const drafts = await db
      .select({ journeyId: journeyDraft.journeyId, revision: journeyDraft.revision })
      .from(journeyDraft);
    const versions = await db
      .select({
        journeyId: journeyVersion.journeyId,
        versionNumber: journeyVersion.versionNumber,
      })
      .from(journeyVersion);
    const draftRevision = new Map(drafts.map((draft) => [draft.journeyId, draft.revision]));
    const latest = new Map<string, number>();
    for (const version of versions) {
      const current = latest.get(version.journeyId) ?? 0;
      if (version.versionNumber > current) latest.set(version.journeyId, version.versionNumber);
    }
    return {
      ok: true as const,
      journeys: definitions.map((definition) => ({
        slug: definition.slug,
        title: definition.title,
        summary: definition.summary,
        origin: definition.origin,
        templateKey: definition.templateKey,
        sandboxNotice: definition.sandboxNotice,
        latestVersion: latest.get(definition.id) ?? null,
        draftRevision: draftRevision.get(definition.id) ?? null,
      })),
    };
  });
}

export async function readStoredJourney(
  connectionString: string,
  slug: string,
): Promise<{ ok: true; journey: StoredJourneyRecord } | RepositoryFailure> {
  return withStore(connectionString, async (db) => {
    const journey = await loadJourney(db, slug);
    if (!journey) return { ok: false, code: "not_found" };
    return { ok: true, journey };
  });
}

export async function readStoredVersion(
  connectionString: string,
  slug: string,
  versionNumber: number,
): Promise<
  | {
      ok: true;
      slug: string;
      origin: JourneyOrigin;
      sandboxNotice: string | null;
      version: StoredVersionSummary & { document: JourneyDocument };
    }
  | RepositoryFailure
> {
  return withStore(connectionString, async (db) => {
    const journey = await loadJourney(db, slug);
    if (!journey) return { ok: false, code: "not_found" };
    const version = journey.versions.find((item) => item.versionNumber === versionNumber);
    if (!version) return { ok: false, code: "not_found" };
    return {
      ok: true,
      slug: journey.slug,
      origin: journey.origin,
      sandboxNotice: journey.sandboxNotice,
      version,
    };
  });
}

export async function commitDraftSave(
  connectionString: string,
  input: {
    slug: string;
    expectedRevision: number;
    document: JourneyDocument;
    actorId: string;
    now: Date;
  },
): Promise<{ ok: true; revision: number } | RepositoryFailure> {
  return withStore(connectionString, async (db) => {
    try {
      return await db.transaction(async (tx) => {
        const definition = await findDefinition(tx, input.slug);
        if (!definition) throw new StoreSignal("not_found");
        const updated = await tx
          .update(journeyDraft)
          .set({
            revision: input.expectedRevision + 1,
            title: input.document.title,
            summary: input.document.summary,
            entryStepId: input.document.entryStepId,
            steps: input.document.steps,
            updatedBy: input.actorId,
            updatedAt: input.now,
          })
          .where(
            and(eq(journeyDraft.journeyId, definition.id), eq(journeyDraft.revision, input.expectedRevision)),
          )
          .returning({ journeyId: journeyDraft.journeyId });
        if (updated.length !== 1) throw new StoreSignal("revision_conflict");
        await tx
          .update(journeyDefinition)
          .set({
            title: input.document.title,
            summary: input.document.summary,
            updatedAt: input.now,
          })
          .where(eq(journeyDefinition.id, definition.id));
        return { ok: true as const, revision: input.expectedRevision + 1 };
      });
    } catch (error) {
      const signal = signalCode(error);
      if (signal) return { ok: false, code: signal };
      throw error;
    }
  });
}

export async function commitPublishedVersion(
  connectionString: string,
  input: PublishCommitInput & { now: Date },
): Promise<
  { ok: true; versionNumber: number; revision: number; contentHash: string } | RepositoryFailure
> {
  return withStore(connectionString, async (db) => {
    try {
      return await db.transaction(async (tx) => {
        const definition = await findDefinition(tx, input.slug);
        if (!definition) throw new StoreSignal("not_found");
        const versions = await tx
          .select({
            versionNumber: journeyVersion.versionNumber,
            contentHash: journeyVersion.contentHash,
          })
          .from(journeyVersion)
          .where(eq(journeyVersion.journeyId, definition.id));
        const latest = versions.reduce<(typeof versions)[number] | null>((current, version) => {
          if (!current || version.versionNumber > current.versionNumber) return version;
          return current;
        }, null);
        if (latest?.contentHash === input.contentHash) throw new StoreSignal("unchanged_draft");
        if ((latest?.versionNumber ?? 0) + 1 !== input.versionNumber) {
          throw new StoreSignal("revision_conflict");
        }
        const updated = await tx
          .update(journeyDraft)
          .set({
            revision: input.expectedRevision + 1,
            title: input.document.title,
            summary: input.document.summary,
            entryStepId: input.document.entryStepId,
            steps: input.document.steps,
            updatedBy: input.actorId,
            updatedAt: input.now,
            basedOnVersion: input.versionNumber,
          })
          .where(
            and(eq(journeyDraft.journeyId, definition.id), eq(journeyDraft.revision, input.expectedRevision)),
          )
          .returning({ journeyId: journeyDraft.journeyId });
        if (updated.length !== 1) throw new StoreSignal("revision_conflict");
        await tx.insert(journeyVersion).values({
          id: input.versionId,
          journeyId: definition.id,
          versionNumber: input.versionNumber,
          title: input.document.title,
          summary: input.document.summary,
          entryStepId: input.document.entryStepId,
          steps: input.document.steps,
          contentHash: input.contentHash,
          publishedBy: input.actorId,
          publishedAt: input.now,
        });
        await tx
          .update(journeyDefinition)
          .set({
            title: input.document.title,
            summary: input.document.summary,
            updatedAt: input.now,
          })
          .where(eq(journeyDefinition.id, definition.id));
        return {
          ok: true as const,
          versionNumber: input.versionNumber,
          revision: input.expectedRevision + 1,
          contentHash: input.contentHash,
        };
      });
    } catch (error) {
      const signal = signalCode(error);
      if (signal) return { ok: false, code: signal };
      throw error;
    }
  });
}

export async function insertOperatorJourney(
  connectionString: string,
  input: { slug: string; document: JourneyDocument; actorId: string; now: Date },
): Promise<{ ok: true; slug: string; revision: number } | RepositoryFailure> {
  return withStore(connectionString, async (db) => {
    try {
      await db.transaction(async (tx) => {
        const id = randomUUID();
        await tx.insert(journeyDefinition).values({
          id,
          slug: input.slug,
          origin: "operator",
          templateKey: null,
          title: input.document.title,
          summary: input.document.summary,
          sandboxNotice: null,
          createdBy: input.actorId,
          createdAt: input.now,
          updatedAt: input.now,
        });
        await tx.insert(journeyDraft).values({
          journeyId: id,
          revision: 1,
          title: input.document.title,
          summary: input.document.summary,
          entryStepId: input.document.entryStepId,
          steps: input.document.steps,
          updatedBy: input.actorId,
          updatedAt: input.now,
          basedOnVersion: null,
        });
      });
      return { ok: true, slug: input.slug, revision: 1 };
    } catch (error) {
      if (readPgCode(error) === "23505") return { ok: false, code: "slug_taken" };
      const signal = signalCode(error);
      if (signal) return { ok: false, code: signal };
      throw error;
    }
  });
}

async function loadJourney(db: Database, slug: string): Promise<StoredJourneyRecord | null> {
  const definition = await findDefinition(db, slug);
  if (!definition) return null;
  const drafts = await db.select().from(journeyDraft).where(eq(journeyDraft.journeyId, definition.id));
  const versions = await db
    .select()
    .from(journeyVersion)
    .where(eq(journeyVersion.journeyId, definition.id))
    .orderBy(journeyVersion.versionNumber);
  const draftRow = drafts[0];
  const draft = draftRow
    ? {
        revision: draftRow.revision,
        basedOnVersion: draftRow.basedOnVersion,
        updatedAt: draftRow.updatedAt.toISOString(),
        document: documentFromColumns(draftRow),
      }
    : null;
  return {
    id: definition.id,
    slug: definition.slug,
    title: definition.title,
    summary: definition.summary,
    origin: definition.origin,
    templateKey: definition.templateKey,
    sandboxNotice: definition.sandboxNotice,
    draft,
    versions: versions.map((version) => ({
      versionNumber: version.versionNumber,
      contentHash: version.contentHash,
      publishedBy: version.publishedBy,
      publishedAt: version.publishedAt.toISOString(),
      title: version.title,
      document: documentFromColumns(version),
    })),
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
  if (!validated.ok) throw new StoreSignal("stored_journey_invalid");
  return validated.document;
}

async function findDefinition(db: Database, slug: string) {
  const rows = await db.select().from(journeyDefinition).where(eq(journeyDefinition.slug, slug));
  return rows[0] ?? null;
}

async function withStore<T>(connectionString: string, run: (db: Database) => Promise<T>): Promise<T> {
  const client = createPostgresClient(connectionString);
  try {
    return await run(drizzle(client));
  } finally {
    await client.end({ timeout: 5 }).catch(() => undefined);
  }
}

function signalCode(error: unknown): RepositoryFailure["code"] | null {
  if (error instanceof StoreSignal) return error.storeCode;
  return null;
}
