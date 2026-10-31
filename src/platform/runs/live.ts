import { RUN_MESSAGES } from "@/features/resume-anywhere/messages";
import type {
  RunDetail,
  RunListItem,
  RunRecord,
  StepAction,
} from "@/features/resume-anywhere/model";
import { executeStepSchema, startRunSchema } from "@/features/resume-anywhere/schema";
import {
  commitStepTransition,
  listStoredRuns,
  readStoredRun,
  startStoredRun,
} from "@/platform/runs/repository";
import { readClerkConfig } from "@/shared/config/clerk";
import { loadConfig } from "@/shared/config/env";
import { readPgCode } from "@/shared/db/postgres-error";

export type RunOperationFailure = {
  ok: false;
  status: number;
  code: string;
  message: string;
};

export type CurrentUserAuth =
  | { ok: true; userId: string }
  | RunOperationFailure;

export async function getCurrentUserAuth(): Promise<CurrentUserAuth> {
  const clerk = readClerkConfig(process.env);
  if (!clerk.configured) {
    return {
      ok: false,
      status: 503,
      code: "auth_not_configured",
      message: RUN_MESSAGES.auth_not_configured,
    };
  }

  const { auth } = await import("@clerk/nextjs/server");
  const session = await auth();
  if (!session.userId) {
    return {
      ok: false,
      status: 401,
      code: "unauthenticated",
      message: RUN_MESSAGES.unauthenticated,
    };
  }

  return { ok: true, userId: session.userId };
}

export async function startRun(input: {
  journeySlug: string;
  versionNumber: number;
  idempotencyKey?: string;
}): Promise<{ ok: true; run: RunRecord; replayed?: boolean } | RunOperationFailure> {
  const user = await getCurrentUserAuth();
  if (!user.ok) return user;

  const parsed = startRunSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      status: 422,
      code: "invalid_input",
      message: parsed.error.issues.map((i) => i.message).join(" "),
    };
  }

  const database = openDatabase();
  if (!database.ok) return database;

  try {
    const started = await startStoredRun(database.connectionString, {
      journeySlug: parsed.data.journeySlug,
      versionNumber: parsed.data.versionNumber,
      ownerId: user.userId,
      idempotencyKey: parsed.data.idempotencyKey,
      now: new Date(),
    });

    if (!started.ok) return mapStoredFailure(started.code, started.message);
    return started;
  } catch (error) {
    return mapDatabaseError(error);
  }
}

export async function listMyRuns(): Promise<
  { ok: true; runs: RunListItem[] } | RunOperationFailure
> {
  const user = await getCurrentUserAuth();
  if (!user.ok) return user;

  const database = openDatabase();
  if (!database.ok) return database;

  try {
    const listed = await listStoredRuns(database.connectionString, {
      ownerId: user.userId,
    });
    if (!listed.ok) return mapStoredFailure(listed.code, listed.message);
    return listed;
  } catch (error) {
    return mapDatabaseError(error);
  }
}

export async function readRun(
  runId: string,
): Promise<{ ok: true; detail: RunDetail } | RunOperationFailure> {
  const user = await getCurrentUserAuth();
  if (!user.ok) return user;

  const database = openDatabase();
  if (!database.ok) return database;

  try {
    const loaded = await readStoredRun(database.connectionString, {
      runId,
      ownerId: user.userId,
    });
    if (!loaded.ok) return mapStoredFailure(loaded.code, loaded.message);
    return loaded;
  } catch (error) {
    return mapDatabaseError(error);
  }
}

export async function executeStep(input: {
  runId: string;
  expectedRevision: number;
  action: StepAction;
  idempotencyKey?: string;
}): Promise<{ ok: true; run: RunRecord; replayed?: boolean } | RunOperationFailure> {
  const user = await getCurrentUserAuth();
  if (!user.ok) return user;

  const parsed = executeStepSchema.safeParse({
    expectedRevision: input.expectedRevision,
    action: input.action,
    idempotencyKey: input.idempotencyKey,
  });
  if (!parsed.success) {
    return {
      ok: false,
      status: 422,
      code: "invalid_input",
      message: parsed.error.issues.map((i) => i.message).join(" "),
    };
  }

  const database = openDatabase();
  if (!database.ok) return database;

  try {
    const transitioned = await commitStepTransition(database.connectionString, {
      runId: input.runId,
      ownerId: user.userId,
      expectedRevision: parsed.data.expectedRevision,
      action: parsed.data.action,
      idempotencyKey: parsed.data.idempotencyKey,
      now: new Date(),
    });

    if (!transitioned.ok) return mapStoredFailure(transitioned.code, transitioned.message);
    return transitioned;
  } catch (error) {
    return mapDatabaseError(error);
  }
}

export function runResponse(
  result: RunOperationFailure | { ok: true; [key: string]: unknown },
): Response {
  if (!result.ok) {
    return Response.json(
      { ok: false, code: result.code, message: result.message },
      { status: result.status, headers: { "cache-control": "no-store" } },
    );
  }
  return Response.json(result, { status: 200, headers: { "cache-control": "no-store" } });
}

function openDatabase(): { ok: true; connectionString: string } | RunOperationFailure {
  const loaded = loadConfig(process.env);
  if (!loaded.ok || !loaded.config.database.configured) {
    return {
      ok: false,
      status: 503,
      code: "database_not_configured",
      message: loaded.ok ? RUN_MESSAGES.database_not_configured : loaded.issues.join(" "),
    };
  }
  return { ok: true, connectionString: loaded.config.database.connectionString };
}

function mapStoredFailure(code: string, customMessage?: string): RunOperationFailure {
  const message = customMessage ?? (RUN_MESSAGES as Record<string, string>)[code] ?? code;
  let status = 422;

  switch (code) {
    case "not_found":
    case "version_not_found":
    case "run_not_found":
      status = 404;
      break;
    case "unauthorized":
      status = 403;
      break;
    case "unauthenticated":
      status = 401;
      break;
    case "revision_conflict":
    case "run_already_completed":
      status = 409;
      break;
    case "stored_journey_invalid":
      status = 500;
      break;
    default:
      status = 422;
      break;
  }

  return { ok: false, status, code, message };
}

function mapDatabaseError(error: unknown): RunOperationFailure {
  const code = readPgCode(error) ?? "unknown";
  console.error("[repathra] run operation failed", { code });
  if (code === "42P01") {
    return {
      ok: false,
      status: 503,
      code: "schema_not_migrated",
      message: RUN_MESSAGES.schema_not_migrated,
    };
  }
  return {
    ok: false,
    status: 503,
    code: "database_unreachable",
    message: RUN_MESSAGES.database_unreachable,
  };
}
