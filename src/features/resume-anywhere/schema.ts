import { z } from "zod";

import { journeySlugSchema } from "@/features/journey-studio/schema";
import { RUN_STATUSES } from "@/features/resume-anywhere/model";

export const runIdSchema = z.string().uuid();

export const runStatusSchema = z.enum(RUN_STATUSES);

export const idempotencyKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/, "Use letters, numbers, hyphens, and underscores for idempotency keys.");

export const startRunSchema = z.strictObject({
  journeySlug: journeySlugSchema,
  versionNumber: z.number().int().positive(),
  idempotencyKey: idempotencyKeySchema.optional(),
});

export const collectActionSchema = z.strictObject({
  type: z.literal("collect"),
  value: z.string().max(2000),
});

export const reviewActionSchema = z.strictObject({
  type: z.literal("review"),
  acknowledged: z.boolean(),
});

export const outcomeIdSchema = z
  .string()
  .trim()
  .regex(/^[a-z][a-z0-9-]{0,32}$/, "Use a lowercase outcome id.");

export const decideActionSchema = z.strictObject({
  type: z.literal("decide"),
  outcomeId: outcomeIdSchema,
});

export const stepActionSchema = z.discriminatedUnion("type", [
  collectActionSchema,
  reviewActionSchema,
  decideActionSchema,
]);

export const executeStepSchema = z.strictObject({
  expectedRevision: z.number().int().positive(),
  action: stepActionSchema,
  idempotencyKey: idempotencyKeySchema.optional(),
});
