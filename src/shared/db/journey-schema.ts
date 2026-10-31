import { sql } from "drizzle-orm";
import { check, integer, jsonb, pgEnum, pgTable, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const journeyOriginEnum = pgEnum("journey_origin", ["operator", "sandbox"]);
export const journeyTemplateKeyEnum = pgEnum("journey_template_key", ["vendor-onboarding", "service-intake"]);

export const journeyDefinition = pgTable(
  "journey_definition",
  {
    id: uuid("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    origin: journeyOriginEnum("origin").notNull(),
    templateKey: journeyTemplateKeyEnum("template_key"),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    sandboxNotice: text("sandbox_notice"),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("journey_definition_template_key_unique")
      .on(table.templateKey)
      .where(sql`${table.templateKey} is not null`),
    check(
      "journey_definition_origin_shape",
      sql`(
        ${table.origin} = 'sandbox'
        and ${table.templateKey} is not null
        and ${table.sandboxNotice} is not null
        and length(trim(${table.sandboxNotice})) > 0
      ) or (
        ${table.origin} = 'operator'
        and ${table.templateKey} is null
        and ${table.sandboxNotice} is null
      )`,
    ),
  ],
);

export const journeyDraft = pgTable(
  "journey_draft",
  {
    journeyId: uuid("journey_id")
      .primaryKey()
      .references(() => journeyDefinition.id),
    revision: integer("revision").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    entryStepId: text("entry_step_id").notNull(),
    steps: jsonb("steps").notNull(),
    updatedBy: text("updated_by").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    basedOnVersion: integer("based_on_version"),
  },
  (table) => [check("journey_draft_revision_positive", sql`${table.revision} >= 1`)],
);

export const journeyVersion = pgTable(
  "journey_version",
  {
    id: uuid("id").primaryKey(),
    journeyId: uuid("journey_id")
      .notNull()
      .references(() => journeyDefinition.id),
    versionNumber: integer("version_number").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    entryStepId: text("entry_step_id").notNull(),
    steps: jsonb("steps").notNull(),
    contentHash: text("content_hash").notNull(),
    publishedBy: text("published_by").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("journey_version_journey_number_unique").on(table.journeyId, table.versionNumber),
    check("journey_version_number_positive", sql`${table.versionNumber} >= 1`),
    check("journey_version_hash_sha256", sql`${table.contentHash} ~ '^[a-f0-9]{64}$'`),
  ],
);
