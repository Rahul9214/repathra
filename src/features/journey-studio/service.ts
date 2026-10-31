import { randomUUID } from "node:crypto";

import { authorizeOperator, type OperatorAuthorizationInput } from "@/features/journey-studio/authorize";
import { journeyContentHash } from "@/features/journey-studio/hash";
import type { JourneyDocument, JourneyIssue } from "@/features/journey-studio/model";
import { JOURNEY_MESSAGES } from "@/features/journey-studio/messages";
import { journeySlugSchema } from "@/features/journey-studio/schema";
import { operatorSkeleton, RESERVED_JOURNEY_SLUGS } from "@/features/journey-studio/templates";
import { validateJourney } from "@/features/journey-studio/validate";

export type JourneyFailure = {
  ok: false;
  code:
    | "auth_not_configured"
    | "unauthenticated"
    | "unauthorized"
    | "invalid_shape"
    | "invalid_transition"
    | "unchanged_draft"
    | "revision_conflict"
    | "not_found"
    | "slug_taken"
    | "slug_reserved"
    | "stored_journey_invalid";
  message: string;
  issues?: JourneyIssue[];
};

export type VersionSnapshot = {
  readonly id: string;
  readonly journeyId: string;
  readonly versionNumber: number;
  readonly document: JourneyDocument;
  readonly contentHash: string;
  readonly publishedBy: string;
  readonly publishedAt: string;
};

type VersionIdentity = {
  versionNumber: number;
  contentHash: string;
};

type ActorInput = OperatorAuthorizationInput;


export function prepareDraftSave(
  input: ActorInput & {
    expectedRevision: number;
    currentRevision: number;
    document: unknown;
  },
): { ok: true; revision: number; document: JourneyDocument; actorId: string } | JourneyFailure {
  const access = authorizeOperator(input);
  if (access.state === "denied") return denied(access.code);
  const revision = revisionFailure(input.expectedRevision, input.currentRevision);
  if (revision) return revision;
  const validated = validateJourney(input.document);
  if (!validated.ok) return invalid(validated.issues);
  return {
    ok: true,
    revision: input.currentRevision + 1,
    document: validated.document,
    actorId: access.userId,
  };
}

export function preparePublish(
  input: ActorInput & {
    journeyId: string;
    expectedRevision: number;
    currentRevision: number;
    versions: readonly VersionIdentity[];
    document: unknown;
    now: Date;
    versionId?: string;
  },
):
  | {
      ok: true;
      document: JourneyDocument;
      version: VersionSnapshot;
      nextRevision: number;
      actorId: string;
    }
  | JourneyFailure {
  const access = authorizeOperator(input);
  if (access.state === "denied") return denied(access.code);
  const revision = revisionFailure(input.expectedRevision, input.currentRevision);
  if (revision) return revision;
  const validated = validateJourney(input.document);
  if (!validated.ok) return invalid(validated.issues);

  const document = freezeDocument(validated.document);
  const contentHash = journeyContentHash(document);
  const latest = latestVersion(input.versions);
  if (latest && latest.contentHash === contentHash) {
    return { ok: false, code: "unchanged_draft", message: JOURNEY_MESSAGES.unchanged_draft };
  }

  const versionNumber = (latest?.versionNumber ?? 0) + 1;
  const version: VersionSnapshot = Object.freeze({
    id: input.versionId ?? randomUUID(),
    journeyId: input.journeyId,
    versionNumber,
    document,
    contentHash,
    publishedBy: access.userId,
    publishedAt: input.now.toISOString(),
  });

  return {
    ok: true,
    document,
    version,
    nextRevision: input.currentRevision + 1,
    actorId: access.userId,
  };
}

export function prepareOperatorJourney(
  input: ActorInput & { slug?: unknown; title?: unknown; summary?: unknown },
): { ok: true; slug: string; document: JourneyDocument; actorId: string } | JourneyFailure {
  const access = authorizeOperator(input);
  if (access.state === "denied") return denied(access.code);
  const slug = journeySlugSchema.safeParse(input.slug);
  if (!slug.success) {
    return {
      ok: false,
      code: "invalid_shape",
      message: slug.error.issues[0]?.message ?? JOURNEY_MESSAGES.invalid_document,
      issues: slug.error.issues.map((issue) => ({
        code: "invalid_shape" as const,
        path: "slug",
        message: issue.message,
      })),
    };
  }
  if (RESERVED_JOURNEY_SLUGS.has(slug.data)) {
    return { ok: false, code: "slug_reserved", message: JOURNEY_MESSAGES.slug_reserved };
  }

  const title = typeof input.title === "string" ? input.title : "";
  const summary = typeof input.summary === "string" ? input.summary : "";
  const document = operatorSkeleton(title, summary);
  const validated = validateJourney(document);
  if (!validated.ok) return invalid(validated.issues);
  return { ok: true, slug: slug.data, document: validated.document, actorId: access.userId };
}

export type PublishCommitInput = {
  slug: string;
  expectedRevision: number;
  document: JourneyDocument;
  contentHash: string;
  versionNumber: number;
  versionId: string;
  actorId: string;
  publishedAt: string;
};

export async function publishJourney(
  deps: {
    commit: (
      input: PublishCommitInput,
    ) => Promise<
      | { ok: true; versionNumber: number; revision: number; contentHash: string }
      | { ok: false; code: "not_found" | "revision_conflict" | "unchanged_draft" | "slug_taken" | "stored_journey_invalid" }
    >;
  },
  input: ActorInput & {
    slug: string;
    journeyId: string;
    expectedRevision: number;
    currentRevision: number;
    versions: readonly VersionIdentity[];
    document: unknown;
    now: Date;
    versionId?: string;
  },
): Promise<
  | {
      ok: true;
      versionNumber: number;
      revision: number;
      contentHash: string;
      publishedBy: string;
      document: JourneyDocument;
    }
  | JourneyFailure
> {
  const prepared = preparePublish(input);
  if (!prepared.ok) return prepared;
  const committed = await deps.commit({
    slug: input.slug,
    expectedRevision: input.expectedRevision,
    document: prepared.document,
    contentHash: prepared.version.contentHash,
    versionNumber: prepared.version.versionNumber,
    versionId: prepared.version.id,
    actorId: prepared.actorId,
    publishedAt: prepared.version.publishedAt,
  });
  if (!committed.ok) {
    return {
      ok: false,
      code: committed.code,
      message: JOURNEY_MESSAGES[committed.code],
    };
  }
  return {
    ok: true,
    versionNumber: committed.versionNumber,
    revision: committed.revision,
    contentHash: committed.contentHash,
    publishedBy: prepared.actorId,
    document: prepared.document,
  };
}

export async function saveJourneyDraft(
  deps: {
    commit: (input: {
      slug: string;
      expectedRevision: number;
      document: JourneyDocument;
      actorId: string;
    }) => Promise<{ ok: true; revision: number } | { ok: false; code: "not_found" | "revision_conflict" | "unchanged_draft" | "slug_taken" | "stored_journey_invalid" }>;
  },
  input: ActorInput & {
    slug: string;
    expectedRevision: number;
    currentRevision: number;
    document: unknown;
  },
): Promise<{ ok: true; revision: number; document: JourneyDocument } | JourneyFailure> {
  const prepared = prepareDraftSave(input);
  if (!prepared.ok) return prepared;
  const committed = await deps.commit({
    slug: input.slug,
    expectedRevision: input.expectedRevision,
    document: prepared.document,
    actorId: prepared.actorId,
  });
  if (!committed.ok) {
    return { ok: false, code: committed.code, message: JOURNEY_MESSAGES[committed.code] };
  }
  return { ok: true, revision: committed.revision, document: prepared.document };
}

function denied(code: "auth_not_configured" | "unauthenticated" | "unauthorized"): JourneyFailure {
  return { ok: false, code, message: JOURNEY_MESSAGES[code] };
}

function revisionFailure(expectedRevision: number, currentRevision: number): JourneyFailure | null {
  if (!Number.isInteger(expectedRevision) || expectedRevision < 1) {
    return {
      ok: false,
      code: "invalid_shape",
      message: "The draft revision is missing.",
      issues: [{ code: "invalid_shape", path: "expectedRevision", message: "The draft revision is missing." }],
    };
  }
  if (expectedRevision !== currentRevision) {
    return { ok: false, code: "revision_conflict", message: JOURNEY_MESSAGES.revision_conflict };
  }
  return null;
}

function invalid(issues: JourneyIssue[]): JourneyFailure {
  const transition = issues.find((issue) => issue.code === "invalid_transition");
  const code = transition ? "invalid_transition" : "invalid_shape";
  return {
    ok: false,
    code,
    message: transition?.message ?? issues[0]?.message ?? JOURNEY_MESSAGES.invalid_document,
    issues,
  };
}

function latestVersion(versions: readonly VersionIdentity[]): VersionIdentity | null {
  return versions.reduce<VersionIdentity | null>((latest, version) => {
    if (!latest || version.versionNumber > latest.versionNumber) return version;
    return latest;
  }, null);
}

function freezeDocument(document: JourneyDocument): JourneyDocument {
  const copy = structuredClone(document);
  for (const step of copy.steps) {
    if (step.type === "decide") {
      for (const outcome of step.outcomes) Object.freeze(outcome);
      Object.freeze(step.outcomes);
    }
    Object.freeze(step);
  }
  Object.freeze(copy.steps);
  return Object.freeze(copy);
}
