import { integer, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { CAPABILITY_IDS, CAPABILITY_STATUSES } from "../contracts/capability";

export {
  journeyDefinition,
  journeyDraft,
  journeyOriginEnum,
  journeyTemplateKeyEnum,
  journeyVersion,
} from "./journey-schema";

export {
  journeyRun,
  journeyRunEvent,
  journeyRunStatusEnum,
} from "./run-schema";

export {
  failureCategoryEnum,
  incident,
  incidentEvent,
  incidentSeverityEnum,
  incidentStatusEnum,
  signal,
  signalProvenanceEnum,
} from "./signal-schema";

export const capabilityIdEnum = pgEnum("capability_id", CAPABILITY_IDS);
export const capabilityStatusEnum = pgEnum("capability_status", CAPABILITY_STATUSES);

export const platformRelease = pgTable("platform_release", {
  id: text("id").primaryKey(),
  productName: text("product_name").notNull(),
  productVersion: text("product_version").notNull(),
  tagline: text("tagline").notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
});

export const capability = pgTable("capability", {
  id: capabilityIdEnum("id").primaryKey(),
  name: text("name").notNull(),
  summary: text("summary").notNull(),
  status: capabilityStatusEnum("status").notNull().default("registered"),
  sortOrder: integer("sort_order").notNull().unique(),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
});
