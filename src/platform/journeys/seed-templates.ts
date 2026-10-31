import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";

import { journeyContentHash } from "@/features/journey-studio/hash";
import { SANDBOX_TEMPLATES, SYSTEM_SANDBOX_ACTOR } from "@/features/journey-studio/templates";
import { validateJourney } from "@/features/journey-studio/validate";
import { createPostgresClient } from "@/shared/db/connection";
import { journeyDefinition, journeyDraft, journeyVersion } from "@/shared/db/journey-schema";
import { readPgCode } from "@/shared/db/postgres-error";

export type JourneySeedResult =
  | { ok: true; templates: number; versionsInserted: number; draftsInserted: number }
  | { ok: false; message: string };

export async function seedJourneyTemplates(connectionString: string): Promise<JourneySeedResult> {
  const client = createPostgresClient(connectionString);
  const db = drizzle(client);
  let versionsInserted = 0;
  let draftsInserted = 0;

  try {
    await db.transaction(async (tx) => {
      for (const template of SANDBOX_TEMPLATES) {
        const validated = validateJourney(template.document);
        if (!validated.ok) {
          throw new Error("template_invalid");
        }
        const document = validated.document;
        const existing = await tx
          .select()
          .from(journeyDefinition)
          .where(eq(journeyDefinition.slug, template.slug));
        const definition = existing[0];
        const definitionId = definition?.id ?? template.definitionId;
        if (!definition) {
          await tx.insert(journeyDefinition).values({
            id: template.definitionId,
            slug: template.slug,
            origin: "sandbox",
            templateKey: template.templateKey,
            title: document.title,
            summary: document.summary,
            sandboxNotice: template.sandboxNotice,
            createdBy: SYSTEM_SANDBOX_ACTOR,
          });
        } else if (definition.origin !== "sandbox" || definition.templateKey !== template.templateKey) {
          throw new Error("template_conflict");
        }

        const versions = await tx
          .select({ id: journeyVersion.id })
          .from(journeyVersion)
          .where(eq(journeyVersion.journeyId, definitionId));
        if (versions.length === 0) {
          await tx.insert(journeyVersion).values({
            id: template.versionId,
            journeyId: definitionId,
            versionNumber: 1,
            title: document.title,
            summary: document.summary,
            entryStepId: document.entryStepId,
            steps: document.steps,
            contentHash: journeyContentHash(document),
            publishedBy: SYSTEM_SANDBOX_ACTOR,
          });
          versionsInserted += 1;
        }

        const drafts = await tx
          .select({ journeyId: journeyDraft.journeyId })
          .from(journeyDraft)
          .where(eq(journeyDraft.journeyId, definitionId));
        if (drafts.length === 0) {
          await tx.insert(journeyDraft).values({
            journeyId: definitionId,
            revision: 1,
            title: document.title,
            summary: document.summary,
            entryStepId: document.entryStepId,
            steps: document.steps,
            updatedBy: SYSTEM_SANDBOX_ACTOR,
            basedOnVersion: 1,
          });
          draftsInserted += 1;
        }
      }
    });

    return {
      ok: true,
      templates: SANDBOX_TEMPLATES.length,
      versionsInserted,
      draftsInserted,
    };
  } catch (error) {
    if (readPgCode(error) === "42P01") {
      return {
        ok: false,
        message:
          "The journey tables are not migrated. Run pnpm db:migrate before seeding journeys. No sandbox journey was committed.",
      };
    }
    if (error instanceof Error && error.message === "template_conflict") {
      return {
        ok: false,
        message: "A sandbox slug is already stored as a different journey. No sandbox journey was changed.",
      };
    }
    return {
      ok: false,
      message: "Seeding sandbox journeys failed. No new sandbox version was committed.",
    };
  } finally {
    await client.end({ timeout: 5 }).catch(() => undefined);
  }
}
