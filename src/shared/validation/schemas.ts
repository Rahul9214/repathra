import { z } from "zod";

import { CAPABILITY_IDS, LOCKED_CAPABILITIES } from "@/shared/contracts/capability";
import {
  CONFIGURATION_CHECK_STATUSES,
  DATABASE_CHECK_STATUSES,
  OVERALL_HEALTH_STATUSES,
} from "@/shared/contracts/health";
import { PRODUCT } from "@/shared/contracts/product";

export const capabilityContractSchema = z.object({
  id: z.enum(CAPABILITY_IDS),
  name: z.string().min(1),
  summary: z.string().min(1),
  status: z.literal("registered"),
});

export const healthReportSchema = z
  .object({
    service: z.literal(PRODUCT.service),
    version: z.literal(PRODUCT.version),
    tagline: z.literal(PRODUCT.tagline),
    status: z.enum(OVERALL_HEALTH_STATUSES),
    time: z.iso.datetime(),
    checks: z.object({
      configuration: z.object({
        status: z.enum(CONFIGURATION_CHECK_STATUSES),
        issues: z.array(z.string()),
      }),
      database: z.object({
        status: z.enum(DATABASE_CHECK_STATUSES),
        latencyMs: z.number().int().nonnegative().nullable(),
      }),
    }),
    capabilities: z.array(capabilityContractSchema).length(LOCKED_CAPABILITIES.length),
  })
  .superRefine((report, ctx) => {
    report.capabilities.forEach((capability, index) => {
      const locked = LOCKED_CAPABILITIES[index];
      if (!locked || capability.id !== locked.id || capability.name !== locked.name) {
        ctx.addIssue({
          code: "custom",
          message: "Capability order does not match the locked product contract.",
        });
      }
    });
  });

export const healthFailureSchema = z.object({
  service: z.literal(PRODUCT.service),
  status: z.literal("unavailable"),
  message: z.string().min(1),
});
