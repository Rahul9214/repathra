import { connection } from "next/server";

import { JOURNEY_MESSAGES } from "@/features/journey-studio/messages";
import {
  createOperatorJourney,
  listJourneys,
  operationResponse,
  publishDraft,
  readJourney,
  readPublishedVersion,
  saveDraft,
  type OperationFailure,
} from "@/platform/journeys/live";

const JSON_LIMIT = 100_000;

export async function beginJourneyRequest(): Promise<void> {
  await connection();
}

export async function readJsonBody(request: Request): Promise<unknown | OperationFailure> {
  const text = await request.text();
  if (text.length > JSON_LIMIT) {
    return {
      ok: false,
      status: 422,
      code: "invalid_shape",
      message: "The journey document is too large.",
    };
  }
  if (text.trim() === "") {
    return { ok: false, status: 422, code: "invalid_shape", message: "The request body must be JSON." };
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { ok: false, status: 422, code: "invalid_shape", message: "The request body must be JSON." };
  }
}

export function isOperationFailure(value: unknown): value is OperationFailure {
  return Boolean(value && typeof value === "object" && "ok" in value && value.ok === false && "status" in value);
}

export function operationGuard(failure: OperationFailure): Response {
  return operationResponse(failure);
}

export function documentPayload(body: unknown): { expectedRevision: number; document: unknown } | OperationFailure {
  if (!body || typeof body !== "object") {
    return { ok: false, status: 422, code: "invalid_shape", message: JOURNEY_MESSAGES.invalid_document };
  }
  const record = body as { expectedRevision?: unknown; document?: unknown };
  if (typeof record.expectedRevision !== "number") {
    return {
      ok: false,
      status: 422,
      code: "invalid_shape",
      message: "The draft revision is missing.",
    };
  }
  return { expectedRevision: record.expectedRevision, document: record.document };
}

export async function listJourneysResponse(): Promise<Response> {
  return operationResponse(await listJourneys());
}

export async function journeyDetailResponse(slug: string): Promise<Response> {
  const result = await readJourney(slug);
  if (!result.ok) return operationResponse(result);
  const draft = result.draftAccess === "allowed" ? result.journey.draft : null;
  return operationResponse({
    ok: true,
    draftAccess: result.draftAccess,
    journey: {
      slug: result.journey.slug,
      title: result.journey.title,
      summary: result.journey.summary,
      origin: result.journey.origin,
      templateKey: result.journey.templateKey,
      sandboxNotice: result.journey.sandboxNotice,
      draft,
      versions: result.journey.versions.map((version) => ({
        versionNumber: version.versionNumber,
        title: version.title,
        contentHash: version.contentHash,
        publishedBy: version.publishedBy,
        publishedAt: version.publishedAt,
        document: version.document,
      })),
    },
  });
}

export async function publishedVersionResponse(slug: string, version: string): Promise<Response> {
  if (!/^[1-9][0-9]*$/.test(version)) {
    return operationResponse({
      ok: false,
      status: 404,
      code: "version_not_found",
      message: JOURNEY_MESSAGES.version_not_found,
    });
  }
  return operationResponse(await readPublishedVersion(slug, Number(version)));
}

export async function saveDraftResponse(slug: string, body: unknown): Promise<Response> {
  const payload = documentPayload(body);
  if (isOperationFailure(payload)) return operationResponse(payload);
  const result = await saveDraft({ slug, ...payload });
  return operationResponse(result.ok ? { ...result } : result);
}

export async function publishResponse(slug: string, body: unknown): Promise<Response> {
  const payload = documentPayload(body);
  if (isOperationFailure(payload)) return operationResponse(payload);
  const result = await publishDraft({ slug, ...payload });
  return operationResponse(result.ok ? { ...result } : result);
}

export async function createJourneyResponse(body: unknown): Promise<Response> {
  if (!body || typeof body !== "object") {
    return operationResponse({
      ok: false,
      status: 422,
      code: "invalid_shape",
      message: JOURNEY_MESSAGES.invalid_document,
    });
  }
  const record = body as { slug?: unknown; title?: unknown; summary?: unknown };
  const result = await createOperatorJourney(record);
  if (!result.ok) return operationResponse(result);
  return Response.json(result, { status: 201, headers: { "cache-control": "no-store" } });
}
