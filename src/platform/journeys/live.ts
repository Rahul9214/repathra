import { authorizeOperator, type OperatorAuthorizationInput } from "@/features/journey-studio/authorize";
import { readClerkConfig } from "@/shared/config/clerk";
import { loadConfig } from "@/shared/config/env";
import type { JourneyDocument, JourneyIssue } from "@/features/journey-studio/model";
import { JOURNEY_MESSAGES } from "@/features/journey-studio/messages";
import { publishJourney, prepareOperatorJourney, saveJourneyDraft } from "@/features/journey-studio/service";
import { readPgCode } from "@/shared/db/postgres-error";
import {
  commitDraftSave,
  commitPublishedVersion,
  insertOperatorJourney,
  listStoredJourneys,
  readStoredJourney,
  readStoredVersion,
  type StoredJourneyListItem,
  type StoredJourneyRecord,
} from "@/platform/journeys/repository";

export type OperationFailure = {
  ok: false;
  status: number;
  code: string;
  message: string;
  issues?: JourneyIssue[];
};

export type JourneyBoard =
  | { ok: true; journeys: StoredJourneyListItem[] }
  | OperationFailure;

export type OperatorGateState = "allowed" | "auth_not_configured" | "unauthenticated" | "unauthorized";

export type JourneyDetail =
  | {
      ok: true;
      journey: StoredJourneyRecord;
      draftAccess: OperatorGateState;
    }
  | OperationFailure;

export async function listJourneys(): Promise<JourneyBoard> {
  const database = openDatabase();
  if (!database.ok) return database;
  try {
    const listed = await listStoredJourneys(database.connectionString);
    if (!listed.ok) return storedFailure(listed.code);
    return listed;
  } catch (error) {
    return mapDatabaseError(error);
  }
}

export async function readJourney(slug: string): Promise<JourneyDetail> {
  const database = openDatabase();
  if (!database.ok) return database;
  try {
    const loaded = await readStoredJourney(database.connectionString, slug);
    if (!loaded.ok) return storedFailure(loaded.code);
    const actor = await currentActor();
    const access =  authorizeOperator(actor);
    const draftAccess: OperatorGateState = access.state === "allowed" ? "allowed" : access.code;
    const draft = draftAccess === "allowed" ? loaded.journey.draft : null;
    return { ok: true, journey: { ...loaded.journey, draft }, draftAccess };
  } catch (error) {
    return mapDatabaseError(error);
  }
}

export async function readPublishedVersion(slug: string, versionNumber: number) {
  const database = openDatabase();
  if (!database.ok) return database;
  try {
    const loaded = await readStoredVersion(database.connectionString, slug, versionNumber);
    if (!loaded.ok) {
      return {
        ok: false as const,
        status: 404,
        code: "version_not_found",
        message: JOURNEY_MESSAGES.version_not_found,
      };
    }
    return loaded;
  } catch (error) {
    return mapDatabaseError(error);
  }
}

export async function saveDraft(input: {
  slug: string;
  expectedRevision: number;
  document: unknown;
}): Promise<{ ok: true; message: string; revision: number; document: JourneyDocument } | OperationFailure> {
  const database = openDatabase();
  if (!database.ok) return database;
  const actor = await currentActor();
  try {
    const current = await readStoredJourney(database.connectionString, input.slug);
    if (!current.ok) return storedFailure(current.code);
    if (!current.journey.draft) {
      return {
        ok: false,
        status: 409,
        code: "revision_conflict",
        message: JOURNEY_MESSAGES.revision_conflict,
      };
    }
    const saved = await saveJourneyDraft(
      {
        commit: (commit) =>
          commitDraftSave(database.connectionString, { ...commit, now: new Date() }),
      },
      {
        ...actor,
        slug: input.slug,
        expectedRevision: input.expectedRevision,
        currentRevision: current.journey.draft.revision,
        document: input.document,
      },
    );
    if (!saved.ok) return serviceFailure(saved.code, saved.message, saved.issues);
    return { ok: true, message: JOURNEY_MESSAGES.draft_saved, revision: saved.revision, document: saved.document };
  } catch (error) {
    return mapDatabaseError(error);
  }
}

export async function publishDraft(input: {
  slug: string;
  expectedRevision: number;
  document: unknown;
}): Promise<
  | { ok: true; message: string; versionNumber: number; revision: number; contentHash: string }
  | OperationFailure
> {
  const database = openDatabase();
  if (!database.ok) return database;
  const actor = await currentActor();
  try {
    const current = await readStoredJourney(database.connectionString, input.slug);
    if (!current.ok) return storedFailure(current.code);
    if (!current.journey.draft) {
      return {
        ok: false,
        status: 409,
        code: "revision_conflict",
        message: JOURNEY_MESSAGES.revision_conflict,
      };
    }
    const published = await publishJourney(
      {
        commit: (commit) =>
          commitPublishedVersion(database.connectionString, { ...commit, now: new Date(commit.publishedAt) }),
      },
      {
        ...actor,
        slug: input.slug,
        journeyId: current.journey.id,
        expectedRevision: input.expectedRevision,
        currentRevision: current.journey.draft.revision,
        versions: current.journey.versions.map((version) => ({
          versionNumber: version.versionNumber,
          contentHash: version.contentHash,
        })),
        document: input.document,
        now: new Date(),
      },
    );
    if (!published.ok) return serviceFailure(published.code, published.message, published.issues);
    return {
      ok: true,
      message: `${JOURNEY_MESSAGES.published} Version ${published.versionNumber} is frozen.`,
      versionNumber: published.versionNumber,
      revision: published.revision,
      contentHash: published.contentHash,
    };
  } catch (error) {
    return mapDatabaseError(error);
  }
}

export async function createOperatorJourney(input: {
  slug?: unknown;
  title?: unknown;
  summary?: unknown;
}): Promise<{ ok: true; message: string; slug: string } | OperationFailure> {
  const database = openDatabase();
  if (!database.ok) return database;
  const actor = await currentActor();
  const prepared = prepareOperatorJourney({ ...actor, ...input });
  if (!prepared.ok) return serviceFailure(prepared.code, prepared.message, prepared.issues);
  try {
    const inserted = await insertOperatorJourney(database.connectionString, {
      slug: prepared.slug,
      document: prepared.document,
      actorId: prepared.actorId,
      now: new Date(),
    });
    if (!inserted.ok) return storedFailure(inserted.code);
    return { ok: true, message: JOURNEY_MESSAGES.created, slug: inserted.slug };
  } catch (error) {
    return mapDatabaseError(error);
  }
}

export function operationResponse(result: OperationFailure | { ok: true; [key: string]: unknown }): Response {
  if (!result.ok) {
    return Response.json(
      { ok: false, code: result.code, message: result.message, issues: result.issues ?? [] },
      { status: result.status, headers: { "cache-control": "no-store" } },
    );
  }
  return Response.json(result, { status: 200, headers: { "cache-control": "no-store" } });
}

export async function operatorGate(): Promise<OperatorGateState> {
  const actor = await currentActor();
  const access = authorizeOperator(actor);
  if (access.state === "denied") return access.code;
  return "allowed";
}

async function currentActor(): Promise<OperatorAuthorizationInput> {
  const clerk = readClerkConfig(process.env);
  if (!clerk.configured) return { clerkConfigured: false, userId: null };
  const { auth } = await import("@clerk/nextjs/server");
  const session = await auth();
  if (!session.userId) {
    return { clerkConfigured: true, userId: null };
  }

  const claims = session.sessionClaims as Record<string, unknown> | undefined;
  const publicMeta = (claims?.public_metadata ?? claims?.publicMetadata ?? {}) as Record<string, unknown>;
  const privateMeta = (claims?.private_metadata ?? claims?.privateMetadata ?? {}) as Record<string, unknown>;

  let role: string | null = null;
  if (typeof privateMeta.role === "string") {
    role = privateMeta.role;
  } else if (typeof publicMeta.role === "string") {
    role = publicMeta.role;
  } else if (typeof claims?.role === "string") {
    role = claims.role;
  }

  let isOperator = Boolean(privateMeta.isOperator ?? publicMeta.isOperator ?? claims?.isOperator);

  const emails: string[] = [];
  if (typeof claims?.email === "string") emails.push(claims.email);
  if (typeof claims?.email_address === "string") emails.push(claims.email_address);

  const envEmails = (process.env.OPERATOR_EMAILS ?? process.env.REPATHRA_OPERATOR_EMAILS ?? "").trim();
  if (envEmails.length > 0 && emails.length === 0) {
    try {
      const { currentUser } = await import("@clerk/nextjs/server");
      const user = await currentUser();
      if (user) {
        for (const addr of user.emailAddresses) {
          if (addr.emailAddress) emails.push(addr.emailAddress);
        }
        if (typeof user.privateMetadata?.role === "string") {
          role = user.privateMetadata.role as string;
        }
        if (user.privateMetadata?.isOperator === true) {
          isOperator = true;
        }
      }
    } catch {
      // ignore network errors if any
    }
  }

  return {
    clerkConfigured: true,
    userId: session.userId,
    email: emails[0] ?? null,
    emails,
    role,
    orgRole: session.orgRole ?? null,
    orgPermissions: session.orgPermissions ?? null,
    isOperator,
  };
}

function openDatabase(): { ok: true; connectionString: string } | OperationFailure {
  const loaded = loadConfig(process.env);
  if (!loaded.ok || !loaded.config.database.configured) {
    return {
      ok: false,
      status: 503,
      code: "database_not_configured",
      message: loaded.ok ? JOURNEY_MESSAGES.database_not_configured : loaded.issues.join(" "),
    };
  }
  return { ok: true, connectionString: loaded.config.database.connectionString };
}

function serviceFailure(code: string, message: string, issues?: JourneyIssue[]): OperationFailure {
  return { ok: false, status: failureStatus(code), code, message, issues };
}

function storedFailure(code: string): OperationFailure {
  if (code === "stored_journey_invalid") {
    return {
      ok: false,
      status: 500,
      code,
      message: "A stored journey failed validation and was not returned.",
    };
  }
  const message =
    code === "slug_taken"
      ? JOURNEY_MESSAGES.slug_taken
      : code === "unchanged_draft"
        ? JOURNEY_MESSAGES.unchanged_draft
        : code === "revision_conflict"
          ? JOURNEY_MESSAGES.revision_conflict
          : JOURNEY_MESSAGES.not_found;
  return { ok: false, status: failureStatus(code), code, message };
}

function failureStatus(code: string): number {
  switch (code) {
    case "auth_not_configured":
    case "database_not_configured":
    case "database_unreachable":
    case "schema_not_migrated":
      return 503;
    case "unauthenticated":
      return 401;
    case "unauthorized":
      return 403;
    case "not_found":
    case "version_not_found":
      return 404;
    case "revision_conflict":
    case "slug_taken":
      return 409;
    case "stored_journey_invalid":
      return 500;
    default:
      return 422;
  }
}

function mapDatabaseError(error: unknown): OperationFailure {
  if (error instanceof Error && error.message === "stored_journey_invalid") {
    console.error("[repathra] journey store failed", { code: "stored_journey_invalid" });
    return storedFailure("stored_journey_invalid");
  }
  const code = readPgCode(error) ?? "unknown";
  console.error("[repathra] journey store failed", { code });
  if (code === "42P01") {
    return {
      ok: false,
      status: 503,
      code: "schema_not_migrated",
      message: JOURNEY_MESSAGES.schema_not_migrated,
    };
  }
  return {
    ok: false,
    status: 503,
    code: "database_unreachable",
    message: JOURNEY_MESSAGES.database_unreachable,
  };
}
