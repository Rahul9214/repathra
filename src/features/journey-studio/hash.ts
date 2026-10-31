import { createHash } from "node:crypto";

import type { JourneyDocument } from "@/features/journey-studio/model";

export function journeyContentHash(document: JourneyDocument): string {
  return createHash("sha256").update(canonicalJson(document)).digest("hex");
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => canonicalize(item));
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((key) => [key, canonicalize(record[key])]),
    );
  }
  return value;
}
