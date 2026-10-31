import { authorizeOperator, type OperatorAuthorizationInput } from "@/features/journey-studio/authorize";
import { SIGNAL_MESSAGES } from "@/features/live-signal-inbox/messages";
import type {
  CapturedSignalInput,
  IncidentDetail,
  IncidentListItem,
  IncidentRecord,
} from "@/features/live-signal-inbox/model";
import { observeHttpCall } from "@/features/live-signal-inbox/observation";
import {
  captureSignalSchema,
  diagnosticProbeSchema,
  incidentActionSchema,
  incidentFilterSchema,
  webhookSignalSchema,
} from "@/features/live-signal-inbox/schema";
import {
  acknowledgeStoredIncident,
  listStoredIncidents,
  readStoredIncident,
  recordSignal,
  resolveStoredIncident,
} from "@/platform/signals/repository";
import { readClerkConfig } from "@/shared/config/clerk";
import { loadConfig } from "@/shared/config/env";
import { readPgCode } from "@/shared/db/postgres-error";

export type SignalOperationFailure = {
  ok: false;
  status: number;
  code: string;
  message: string;
};

export type CurrentOperatorAuth =
  | { ok: true; userId: string }
  | SignalOperationFailure;

export async function getCurrentOperatorAuth(): Promise<CurrentOperatorAuth> {
  const clerk = readClerkConfig(process.env);
  if (!clerk.configured) {
    return {
      ok: false,
      status: 503,
      code: "auth_not_configured",
      message: SIGNAL_MESSAGES.auth_not_configured,
    };
  }

  const { auth } = await import("@clerk/nextjs/server");
  const session = await auth();
  if (!session.userId) {
    return {
      ok: false,
      status: 401,
      code: "unauthenticated",
      message: SIGNAL_MESSAGES.unauthenticated,
    };
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

  const isOperator = Boolean(privateMeta.isOperator ?? publicMeta.isOperator ?? claims?.isOperator);

  const emails: string[] = [];
  if (typeof claims?.email === "string") emails.push(claims.email);
  if (typeof claims?.email_address === "string") emails.push(claims.email_address);

  const input: OperatorAuthorizationInput = {
    clerkConfigured: true,
    userId: session.userId,
    role,
    roles: Array.isArray(claims?.roles) ? (claims.roles as string[]) : undefined,
    orgRole: typeof session.orgRole === "string" ? session.orgRole : undefined,
    orgPermissions: Array.isArray(session.orgPermissions) ? session.orgPermissions : undefined,
    isOperator,
    email: emails[0] ?? null,
    emails,
  };

  const gate = authorizeOperator(input);
  if (gate.state !== "allowed") {
    return {
      ok: false,
      status: 403,
      code: "forbidden_operator_required",
      message: SIGNAL_MESSAGES.forbidden_operator_required,
    };
  }

  return { ok: true, userId: gate.userId };
}

export function openSignalDatabase(): { ok: true; connectionString: string } | SignalOperationFailure {
  const loaded = loadConfig(process.env);
  if (!loaded.ok || !loaded.config.database.configured) {
    return {
      ok: false,
      status: 503,
      code: "database_not_configured",
      message: loaded.ok ? SIGNAL_MESSAGES.database_not_configured : loaded.issues.join(" "),
    };
  }
  return { ok: true, connectionString: loaded.config.database.connectionString };
}

function mapDatabaseError(error: unknown): SignalOperationFailure {
  const pgCode = readPgCode(error);
  if (pgCode === "23505") {
    return {
      ok: false,
      status: 409,
      code: "conflict",
      message: "A database uniqueness conflict occurred while processing the signal.",
    };
  }
  return {
    ok: false,
    status: 500,
    code: "database_error",
    message: error instanceof Error ? error.message : "A database error occurred.",
  };
}

export async function ingestSignal(
  rawInput: unknown,
): Promise<{ ok: true; incidentId: string; signalId: string; replayed: boolean } | SignalOperationFailure> {
  const parsed = captureSignalSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      status: 422,
      code: "invalid_signal_payload",
      message: parsed.error.issues.map((i) => i.message).join(" "),
    };
  }

  const database = openSignalDatabase();
  if (!database.ok) return database;

  try {
    const result = await recordSignal(database.connectionString, parsed.data as CapturedSignalInput);
    if (!result.ok) {
      return {
        ok: false,
        status: 400,
        code: result.code,
        message: result.message,
      };
    }
    return {
      ok: true,
      incidentId: result.incident.id,
      signalId: result.signal.id,
      replayed: result.replayed,
    };
  } catch (error) {
    return mapDatabaseError(error);
  }
}

export async function ingestWebhookSignal(
  rawInput: unknown,
  authHeader: string | null,
): Promise<{ ok: true; incidentId: string; signalId: string } | SignalOperationFailure> {
  const configuredSecret = process.env.SIGNALS_WEBHOOK_SECRET ?? process.env.WEBHOOK_SECRET;
  if (!configuredSecret) {
    return {
      ok: false,
      status: 503,
      code: "webhook_not_configured",
      message: "Webhook ingestion secret is not configured on this server.",
    };
  }

  const expectedBearer = `Bearer ${configuredSecret}`;
  if (!authHeader || (authHeader !== configuredSecret && authHeader !== expectedBearer)) {
    return {
      ok: false,
      status: 401,
      code: "webhook_unauthorized",
      message: "Missing or invalid webhook authorization header.",
    };
  }

  const parsed = webhookSignalSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      status: 422,
      code: "invalid_webhook_payload",
      message: parsed.error.issues.map((i) => i.message).join(" "),
    };
  }

  const database = openSignalDatabase();
  if (!database.ok) return database;

  const capturedInput: CapturedSignalInput = {
    provenance: "authenticated_webhook",
    source: parsed.data.source,
    operation: parsed.data.operation,
    signalKey: parsed.data.signalKey,
    runId: parsed.data.runId,
    failureCategory: parsed.data.failureCategory,
    telemetry: {
      method: "WEBHOOK",
      url: `webhook://${parsed.data.source}/${parsed.data.operation}`,
      status: parsed.data.status ?? null,
      durationMs: parsed.data.durationMs,
      errorMessage: parsed.data.message,
    },
    correlationId: parsed.data.correlationId,
    idempotencyKey: parsed.data.idempotencyKey,
    metadata: parsed.data.metadata,
    occurredAt: new Date().toISOString(),
  };

  try {
    const result = await recordSignal(database.connectionString, capturedInput);
    if (!result.ok) {
      return {
        ok: false,
        status: 400,
        code: result.code,
        message: result.message,
      };
    }
    return {
      ok: true,
      incidentId: result.incident.id,
      signalId: result.signal.id,
    };
  } catch (error) {
    return mapDatabaseError(error);
  }
}

export async function listIncidents(
  filterParams?: unknown,
): Promise<{ ok: true; incidents: IncidentListItem[]; totalCount: number } | SignalOperationFailure> {
  const operator = await getCurrentOperatorAuth();
  if (!operator.ok) return operator;

  const parsed = incidentFilterSchema.safeParse(filterParams ?? {});
  if (!parsed.success) {
    return {
      ok: false,
      status: 422,
      code: "invalid_filter_parameters",
      message: parsed.error.issues.map((i) => i.message).join(" "),
    };
  }

  const database = openSignalDatabase();
  if (!database.ok) return database;

  try {
    const result = await listStoredIncidents(database.connectionString, parsed.data);
    return { ok: true, ...result };
  } catch (error) {
    return mapDatabaseError(error);
  }
}

export async function getIncident(
  incidentId: string,
): Promise<{ ok: true; detail: IncidentDetail } | SignalOperationFailure> {
  const operator = await getCurrentOperatorAuth();
  if (!operator.ok) return operator;

  const database = openSignalDatabase();
  if (!database.ok) return database;

  try {
    const detail = await readStoredIncident(database.connectionString, incidentId);
    if (!detail) {
      return {
        ok: false,
        status: 404,
        code: "incident_not_found",
        message: SIGNAL_MESSAGES.incident_not_found,
      };
    }
    return { ok: true, detail };
  } catch (error) {
    return mapDatabaseError(error);
  }
}

export async function performIncidentAction(
  incidentId: string,
  rawAction: unknown,
): Promise<{ ok: true; incident: IncidentRecord } | SignalOperationFailure> {
  const operator = await getCurrentOperatorAuth();
  if (!operator.ok) return operator;

  const parsed = incidentActionSchema.safeParse(rawAction);
  if (!parsed.success) {
    return {
      ok: false,
      status: 422,
      code: "invalid_incident_action",
      message: parsed.error.issues.map((i) => i.message).join(" "),
    };
  }

  const database = openSignalDatabase();
  if (!database.ok) return database;

  try {
    if (parsed.data.action === "acknowledge") {
      const updated = await acknowledgeStoredIncident(database.connectionString, {
        incidentId,
        actorId: operator.userId,
        notes: parsed.data.notes,
      });
      if (!updated) {
        return {
          ok: false,
          status: 404,
          code: "incident_not_found",
          message: SIGNAL_MESSAGES.incident_not_found,
        };
      }
      return { ok: true, incident: updated };
    }

    if (parsed.data.action === "resolve") {
      const updated = await resolveStoredIncident(database.connectionString, {
        incidentId,
        actorId: operator.userId,
        resolutionNote: parsed.data.resolutionNote,
      });
      if (!updated) {
        return {
          ok: false,
          status: 404,
          code: "incident_not_found",
          message: SIGNAL_MESSAGES.incident_not_found,
        };
      }
      return { ok: true, incident: updated };
    }

    return {
      ok: false,
      status: 400,
      code: "invalid_action",
      message: SIGNAL_MESSAGES.invalid_action,
    };
  } catch (error) {
    return mapDatabaseError(error);
  }
}

export async function runDiagnosticProbe(
  rawInput: unknown,
): Promise<
  | {
      ok: true;
      observation:
        | { ok: true; status: number; durationMs: number }
        | { ok: false; incidentId?: string; failureCategory: string; status: number | null };
    }
  | SignalOperationFailure
> {
  const operator = await getCurrentOperatorAuth();
  if (!operator.ok) return operator;

  const parsed = diagnosticProbeSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      status: 422,
      code: "invalid_diagnostic_probe",
      message: parsed.error.issues.map((i) => i.message).join(" "),
    };
  }

  const outcome = await observeHttpCall({
    url: parsed.data.targetUrl,
    method: parsed.data.method,
    timeoutMs: parsed.data.timeoutMs,
    source: parsed.data.source,
    operation: parsed.data.operation,
    signalKey: parsed.data.signalKey,
    runId: parsed.data.runId,
    provenance: "diagnostic",
  });

  if (outcome.ok) {
    return {
      ok: true,
      observation: {
        ok: true,
        status: outcome.status,
        durationMs: outcome.durationMs,
      },
    };
  }

  // Outcome was a failure - record diagnostic signal to database
  const database = openSignalDatabase();
  let incidentId: string | undefined;

  if (database.ok) {
    try {
      const rec = await recordSignal(database.connectionString, outcome.signal);
      if (rec.ok) {
        incidentId = rec.incident.id;
      }
    } catch {
      // Continue even if DB write fails for diagnostic probe
    }
  }

  return {
    ok: true,
    observation: {
      ok: false,
      incidentId,
      failureCategory: outcome.signal.failureCategory,
      status: outcome.signal.telemetry.status,
    },
  };
}
