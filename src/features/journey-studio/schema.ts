import { z } from "zod";

import { COMPLETE_OUTCOMES, HANDOFF_ROLES, STEP_TYPES } from "@/features/journey-studio/model";

export const stepIdSchema = z
  .string()
  .trim()
  .regex(/^[a-z][a-z0-9-]{0,48}$/, "Use a lowercase step id that starts with a letter.");

const fieldKeySchema = z
  .string()
  .trim()
  .regex(/^[a-z][a-z0-9_]{0,40}$/, "Use a lowercase field key that starts with a letter.");

const signalKeySchema = z
  .string()
  .trim()
  .regex(/^[a-z][a-z0-9-]{0,48}$/, "Use a lowercase signal key that starts with a letter.");

const outcomeIdSchema = z
  .string()
  .trim()
  .regex(/^[a-z][a-z0-9-]{0,32}$/, "Use a lowercase outcome id that starts with a letter.");

const titled = {
  id: stepIdSchema,
  title: z.string().trim().min(1).max(120),
  instruction: z.string().trim().min(1).max(500),
};

export const journeySlugSchema = z
  .string()
  .trim()
  .min(3)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase words separated by hyphens.");

export const stepSchema = z.discriminatedUnion("type", [
  z.strictObject({
    ...titled,
    type: z.literal("collect"),
    fieldKey: fieldKeySchema,
    fieldLabel: z.string().trim().min(1).max(80),
    required: z.boolean(),
    next: stepIdSchema,
  }),
  z.strictObject({
    ...titled,
    type: z.literal("review"),
    next: stepIdSchema,
  }),
  z.strictObject({
    ...titled,
    type: z.literal("decide"),
    outcomes: z
      .array(
        z.strictObject({
          id: outcomeIdSchema,
          label: z.string().trim().min(1).max(80),
          next: stepIdSchema,
        }),
      )
      .min(2)
      .max(4),
  }),
  z.strictObject({
    ...titled,
    type: z.literal("wait"),
    signalKey: signalKeySchema,
    next: stepIdSchema,
  }),
  z.strictObject({
    ...titled,
    type: z.literal("handoff"),
    role: z.enum(HANDOFF_ROLES),
    next: stepIdSchema,
  }),
  z.strictObject({
    ...titled,
    type: z.literal("complete"),
    outcome: z.enum(COMPLETE_OUTCOMES),
    next: z.null(),
  }),
]);

export const journeyDocumentSchema = z.strictObject({
  title: z.string().trim().min(1).max(140),
  summary: z.string().trim().min(1).max(400),
  entryStepId: stepIdSchema,
  steps: z.array(stepSchema).min(2).max(24),
});

export const stepTypeSchema = z.enum(STEP_TYPES);
