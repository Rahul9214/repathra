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
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { journeyDefinition, journeyVersion } from "./journey-schema";

export const journeyRunStatusEnum = pgEnum("journey_run_status", [
  "active",
  "paused",
  "completed",
]);

export const journeyRun = pgTable(
  "journey_run",
  {
    id: uuid("id").primaryKey(),
    journeyId: uuid("journey_id")
      .notNull()
      .references(() => journeyDefinition.id),
    journeyVersionId: uuid("journey_version_id")
      .notNull()
      .references(() => journeyVersion.id),
    versionNumber: integer("version_number").notNull(),
    contentHash: text("content_hash").notNull(),
    ownerId: text("owner_id").notNull(),
    currentStepId: text("current_step_id").notNull(),
    status: journeyRunStatusEnum("status").notNull().default("active"),
    revision: integer("revision").notNull().default(1),
    collectedValues: jsonb("collected_values").notNull().default(sql`'{}'::jsonb`),
    completedStepIds: jsonb("completed_step_ids").notNull().default(sql`'[]'::jsonb`),
    completedOutcome: text("completed_outcome"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("journey_run_owner_updated_idx").on(table.ownerId, table.updatedAt),
    index("journey_run_journey_version_idx").on(table.journeyId, table.versionNumber),
    check("journey_run_revision_positive", sql`${table.revision} >= 1`),
    check("journey_run_version_number_positive", sql`${table.versionNumber} >= 1`),
    check("journey_run_hash_sha256", sql`${table.contentHash} ~ '^[a-f0-9]{64}$'`),
  ],
);

export const journeyRunEvent = pgTable(
  "journey_run_event",
  {
    id: uuid("id").primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => journeyRun.id, { onDelete: "cascade" }),
    sequenceNumber: integer("sequence_number").notNull(),
    eventType: text("event_type").notNull(),
    fromStepId: text("from_step_id"),
    toStepId: text("to_step_id").notNull(),
    action: jsonb("action"),
    idempotencyKey: text("idempotency_key"),
    actorId: text("actor_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("journey_run_event_run_seq_unique").on(table.runId, table.sequenceNumber),
    uniqueIndex("journey_run_event_idempotency_unique")
      .on(table.runId, table.idempotencyKey)
      .where(sql`${table.idempotencyKey} is not null`),
    index("journey_run_event_run_idx").on(table.runId),
  ],
);
