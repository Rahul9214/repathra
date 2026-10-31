"use server";

import { revalidatePath } from "next/cache";

import type { JourneyIssue } from "@/features/journey-studio/model";
import { createOperatorJourney, publishDraft, saveDraft } from "@/platform/journeys/live";

export type StudioActionState = {
  ok: boolean;
  message: string;
  code?: string;
  issues?: JourneyIssue[];
  revision?: number;
  versionNumber?: number;
  slug?: string;
};

function payloadFromForm(formData: FormData): { slug: string; expectedRevision: number; document: unknown } | StudioActionState {
  const raw = formData.get("payload");
  if (typeof raw !== "string") {
    return { ok: false, message: "The draft could not be read.", code: "invalid_shape" };
  }
  try {
    const parsed = JSON.parse(raw) as {
      slug?: unknown;
      expectedRevision?: unknown;
      document?: unknown;
    };
    if (typeof parsed.slug !== "string" || typeof parsed.expectedRevision !== "number") {
      return { ok: false, message: "The draft could not be read.", code: "invalid_shape" };
    }
    return { slug: parsed.slug, expectedRevision: parsed.expectedRevision, document: parsed.document };
  } catch {
    return { ok: false, message: "The draft could not be read.", code: "invalid_shape" };
  }
}

function isState(value: { slug: string } | StudioActionState): value is StudioActionState {
  return "ok" in value;
}

export async function saveDraftAction(
  _previous: StudioActionState | null,
  formData: FormData,
): Promise<StudioActionState> {
  const payload = payloadFromForm(formData);
  if (isState(payload)) return payload;
  const result = await saveDraft(payload);
  if (!result.ok) return { ok: false, message: result.message, code: result.code, issues: result.issues };
  revalidatePath("/");
  revalidatePath(`/journeys/${payload.slug}`);
  return { ok: true, message: result.message, revision: result.revision };
}

export async function publishDraftAction(
  _previous: StudioActionState | null,
  formData: FormData,
): Promise<StudioActionState> {
  const payload = payloadFromForm(formData);
  if (isState(payload)) return payload;
  const result = await publishDraft(payload);
  if (!result.ok) return { ok: false, message: result.message, code: result.code, issues: result.issues };
  revalidatePath("/");
  revalidatePath(`/journeys/${payload.slug}`);
  revalidatePath(`/journeys/${payload.slug}/versions/${result.versionNumber}`);
  return {
    ok: true,
    message: result.message,
    revision: result.revision,
    versionNumber: result.versionNumber,
  };
}

export async function createJourneyAction(
  _previous: StudioActionState | null,
  formData: FormData,
): Promise<StudioActionState> {
  const result = await createOperatorJourney({
    slug: formData.get("slug"),
    title: formData.get("title"),
    summary: formData.get("summary"),
  });
  if (!result.ok) return { ok: false, message: result.message, code: result.code, issues: result.issues };
  revalidatePath("/");
  revalidatePath(`/journeys/${result.slug}`);
  return { ok: true, message: result.message, slug: result.slug };
}
