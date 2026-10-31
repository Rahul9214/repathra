import { describe, expect, it, vi } from "vitest";

import { authorizeOperator } from "@/features/journey-studio/authorize";
import { journeyContentHash } from "@/features/journey-studio/hash";
import { JOURNEY_MESSAGES } from "@/features/journey-studio/messages";
import { publishJourney, preparePublish, saveJourneyDraft } from "@/features/journey-studio/service";
import { SANDBOX_NOTICE, SANDBOX_TEMPLATES } from "@/features/journey-studio/templates";
import { validateJourney } from "@/features/journey-studio/validate";
import { readClerkConfig } from "@/shared/config/clerk";

const vendor = SANDBOX_TEMPLATES[0];
const intake = SANDBOX_TEMPLATES[1];
const now = new Date("2026-10-31T03:40:00.000Z");
const journeyId = "11111111-1111-4111-8111-111111111111";

describe("sandbox journey templates", () => {
  it("publishes two labeled synthetic journeys and no others", () => {
    expect(SANDBOX_TEMPLATES.map((template) => template.slug)).toEqual([
      "vendor-onboarding",
      "service-intake",
    ]);
    for (const template of SANDBOX_TEMPLATES) {
      expect(template.origin).toBe("sandbox");
      expect(template.sandboxNotice).toBe(SANDBOX_NOTICE);
      expect(template.sandboxNotice.toLowerCase()).toContain("synthetic sandbox");
      expect(template.summary.toLowerCase()).not.toContain("live customer");
      expect(validateJourney(template.document).ok).toBe(true);
    }
  });

  it("keeps vendor onboarding and service intake on distinct acyclic routes", () => {
    expect(vendor.document.steps.map((step) => step.type)).toEqual([
      "collect",
      "collect",
      "review",
      "decide",
      "wait",
      "handoff",
      "handoff",
      "complete",
      "complete",
    ]);
    const wait = vendor.document.steps.find((step) => step.type === "wait");
    expect(wait && wait.type === "wait" ? wait.signalKey : null).toBe("vendor-registry");
    expect(intake.document.steps.some((step) => step.type === "decide")).toBe(true);
    expect(intake.document.entryStepId).toBe("collect-request");
    expect(vendor.document.entryStepId).toBe("collect-legal-name");
  });
});

describe("journey validation", () => {
  it("rejects a transition to a step that is not in the journey", () => {
    const document = structuredClone(vendor.document);
    const entry = document.steps[0];
    if (!entry || entry.type !== "collect") throw new Error("expected collect entry");
    entry.next = "missing-step";
    const result = validateJourney(document);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === "invalid_transition")).toBe(true);
      expect(result.issues.some((issue) => issue.message.includes("missing-step"))).toBe(true);
    }
  });

  it("rejects a complete step that still names a next step", () => {
    const document = structuredClone(vendor.document);
    const complete = document.steps.find((step) => step.type === "complete");
    if (!complete) throw new Error("expected complete step");
  const result = validateJourney({
    ...document,
    steps: document.steps.map((step) =>
      step.id === complete.id ? { ...step, next: "collect-legal-name" } : step,
    ),
  } as unknown);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some((issue) => issue.code === "invalid_transition")).toBe(true);
  });

  it("rejects a cycle", () => {
    const document = structuredClone(intake.document);
    const review = document.steps.find((step) => step.id === "review-detail");
    if (!review || review.type !== "review") throw new Error("expected review");
    review.next = "decide-route";
    const result = validateJourney(document);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === "invalid_transition" && /cycle/i.test(issue.message))).toBe(
        true,
      );
    }
  });
});

describe("publishing authorization, versions, and immutability", () => {
  it("does not publish or save when Clerk is not configured", async () => {
    const commit = vi.fn();
    const published = await publishJourney(
      { commit },
      {
        clerkConfigured: false,
        userId: "user_should_not_publish",
        slug: vendor.slug,
        journeyId,
        expectedRevision: 1,
        currentRevision: 1,
        versions: [],
        document: vendor.document,
        now,
      },
    );
    expect(published.ok).toBe(false);
    if (!published.ok) expect(published.code).toBe("auth_not_configured");
    expect(commit).not.toHaveBeenCalled();

    const saved = await saveJourneyDraft(
      { commit },
      {
        clerkConfigured: false,
        userId: "user_should_not_publish",
        slug: vendor.slug,
        expectedRevision: 1,
        currentRevision: 1,
        document: vendor.document,
      },
    );
    expect(saved.ok).toBe(false);
    if (!saved.ok) expect(saved.code).toBe("auth_not_configured");
  });

  it("does not publish an unsigned operator even when Clerk is configured", async () => {
    const commit = vi.fn();
    const published = await publishJourney(
      { commit },
      {
        clerkConfigured: true,
        userId: "  ",
        slug: vendor.slug,
        journeyId,
        expectedRevision: 1,
        currentRevision: 1,
        versions: [],
        document: vendor.document,
        now,
      },
    );
    expect(authorizeOperator({ clerkConfigured: true, userId: null }).state).toBe("denied");
    expect(published.ok).toBe(false);
    if (!published.ok) expect(published.code).toBe("unauthenticated");
    expect(commit).not.toHaveBeenCalled();
  });

  it("rejects mutations from unauthorized accounts that are signed in but lack operator permission", async () => {
    const commit = vi.fn();
    const published = await publishJourney(
      { commit },
      {
        clerkConfigured: true,
        userId: "user_regular_customer",
        slug: vendor.slug,
        journeyId,
        expectedRevision: 1,
        currentRevision: 1,
        versions: [],
        document: vendor.document,
        now,
      },
    );
    expect(published.ok).toBe(false);
    if (!published.ok) expect(published.code).toBe("unauthorized");
    expect(commit).not.toHaveBeenCalled();

    const saved = await saveJourneyDraft(
      { commit },
      {
        clerkConfigured: true,
        userId: "user_regular_customer",
        slug: vendor.slug,
        expectedRevision: 1,
        currentRevision: 1,
        document: vendor.document,
      },
    );
    expect(saved.ok).toBe(false);
    if (!saved.ok) expect(saved.code).toBe("unauthorized");
    expect(commit).not.toHaveBeenCalled();
  });

  it("does not store an invalid transition", async () => {
    const commit = vi.fn();
    const document = structuredClone(vendor.document);
    const entry = document.steps[0];
    if (!entry || entry.type !== "collect") throw new Error("expected collect entry");
    entry.next = "missing-step";
    const published = await publishJourney(
      { commit },
      {
        clerkConfigured: true,
        userId: "user_operator",
        role: "operator",
        slug: vendor.slug,
        journeyId,
        expectedRevision: 1,
        currentRevision: 1,
        versions: [],
        document,
        now,
      },
    );
    expect(published.ok).toBe(false);
    if (!published.ok) expect(published.code).toBe("invalid_transition");
    expect(commit).not.toHaveBeenCalled();
  });

  it("freezes version 1 and appends version 2 without altering the first snapshot", () => {
    const source = structuredClone(vendor.document);
    const first = preparePublish({
      clerkConfigured: true,
      userId: "user_operator",
      role: "operator",
      journeyId,
      expectedRevision: 1,
      currentRevision: 1,
      versions: [],
      document: source,
      now,
      versionId: "33333333-3333-4333-8333-333333333333",
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    source.title = "Changed after publish";
    source.steps[0]!.title = "Changed step";
    expect(first.version.document.title).toBe("Vendor onboarding");
    expect(first.version.document.steps[0]?.title).toBe("Record the sample legal name");
    expect(first.version.versionNumber).toBe(1);
    expect(first.version.publishedBy).toBe("user_operator");
    expect(first.version.contentHash).toHaveLength(64);
    expect(Object.isFrozen(first.version.document)).toBe(true);
    expect(Object.isFrozen(first.version.document.steps)).toBe(true);
    expect(() => {
      first.version.document.title = "rewritten";
    }).toThrow(TypeError);

    const same = preparePublish({
      clerkConfigured: true,
      userId: "user_operator",
      role: "operator",
      journeyId,
      expectedRevision: 2,
      currentRevision: 2,
      versions: [{ versionNumber: 1, contentHash: first.version.contentHash }],
      document: first.version.document,
      now,
    });
    expect(same.ok).toBe(false);
    if (!same.ok) expect(same.code).toBe("unchanged_draft");

    const edited = structuredClone(first.version.document);
    edited.summary = `${edited.summary} The sandbox copy was revised.`;
    const second = preparePublish({
      clerkConfigured: true,
      userId: "user_operator",
      role: "operator",
      journeyId,
      expectedRevision: 2,
      currentRevision: 2,
      versions: [{ versionNumber: 1, contentHash: first.version.contentHash }],
      document: edited,
      now,
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.version.versionNumber).toBe(2);
    expect(second.version.contentHash).not.toBe(first.version.contentHash);
    expect(first.version.versionNumber).toBe(1);
    expect(first.version.document.summary).not.toContain("revised");
  });

  it("hashes the same journey once regardless of key order", () => {
    const forward = journeyContentHash(vendor.document);
    const reversed = journeyContentHash({
      steps: vendor.document.steps,
      entryStepId: vendor.document.entryStepId,
      summary: vendor.document.summary,
      title: vendor.document.title,
    });
    expect(reversed).toBe(forward);
  });

  it("rejects a stale revision before writing", async () => {
    const commit = vi.fn();
    const published = await publishJourney(
      { commit },
      {
        clerkConfigured: true,
        userId: "user_operator",
        role: "operator",
        slug: vendor.slug,
        journeyId,
        expectedRevision: 1,
        currentRevision: 2,
        versions: [],
        document: vendor.document,
        now,
      },
    );
    expect(published.ok).toBe(false);
    if (!published.ok) expect(published.code).toBe("revision_conflict");
    expect(commit).not.toHaveBeenCalled();
  });
});

describe("Clerk operator configuration", () => {
  it("fails closed without echoing a key", () => {
    const secret = `sk_test_${"s".repeat(24)}`;
    const missing = readClerkConfig({});
    expect(missing.configured).toBe(false);
    if (!missing.configured) {
      expect(missing.issues.join(" ")).toContain("not set");
      expect(missing.issues.join(" ")).not.toContain(secret);
    }

    const partial = readClerkConfig({ CLERK_SECRET_KEY: secret });
    expect(partial.configured).toBe(false);
    if (!partial.configured) expect(partial.issues.join(" ")).not.toContain(secret);

    const malformed = readClerkConfig({
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: `pk_test_${"p".repeat(12)} leaked`,
      CLERK_SECRET_KEY: secret,
    });
    expect(malformed.configured).toBe(false);
    if (!malformed.configured) {
      expect(malformed.issues.join(" ")).not.toContain("leaked");
      expect(malformed.issues.join(" ")).not.toContain(secret);
    }
  });

  it("accepts a paired test key without returning the key material", () => {
    const publishable = `pk_test_${"p".repeat(24)}`;
    const secret = `sk_test_${"s".repeat(24)}`;
    const ready = readClerkConfig({
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: publishable,
      CLERK_SECRET_KEY: secret,
    });
    expect(ready).toEqual({ configured: true });
    expect(JSON.stringify(ready)).not.toContain(secret);
    expect(JSON.stringify(ready)).not.toContain(publishable);
  });
});

describe("Operator authorization policy", () => {
  it("denies access when Clerk is not configured", () => {
    const access = authorizeOperator({ clerkConfigured: false, userId: "user_operator" });
    expect(access).toEqual({ state: "denied", code: "auth_not_configured" });
  });

  it("denies access when user is not signed in", () => {
    expect(authorizeOperator({ clerkConfigured: true, userId: null })).toEqual({
      state: "denied",
      code: "unauthenticated",
    });
    expect(authorizeOperator({ clerkConfigured: true, userId: "" })).toEqual({
      state: "denied",
      code: "unauthenticated",
    });
    expect(authorizeOperator({ clerkConfigured: true, userId: "   " })).toEqual({
      state: "denied",
      code: "unauthenticated",
    });
  });

  it("denies signed-in users without operator credentials", () => {
    const access = authorizeOperator({ clerkConfigured: true, userId: "user_regular_visitor" });
    expect(access).toEqual({ state: "denied", code: "unauthorized" });
  });

  it("never grants privileges based on username prefixes, test fixture identifiers, or arbitrary usernames", () => {
    expect(authorizeOperator({ clerkConfigured: true, userId: "user_operator" })).toEqual({
      state: "denied",
      code: "unauthorized",
    });
    expect(authorizeOperator({ clerkConfigured: true, userId: "operator_station_1" })).toEqual({
      state: "denied",
      code: "unauthorized",
    });
    expect(authorizeOperator({ clerkConfigured: true, userId: "station_1_operator" })).toEqual({
      state: "denied",
      code: "unauthorized",
    });
    expect(authorizeOperator({ clerkConfigured: true, userId: "operator_admin" })).toEqual({
      state: "denied",
      code: "unauthorized",
    });
  });

  it("authorizes operators by role or roles array", () => {
    expect(
      authorizeOperator({ clerkConfigured: true, userId: "user_custom", role: "operator" }),
    ).toEqual({ state: "allowed", userId: "user_custom" });

    expect(
      authorizeOperator({ clerkConfigured: true, userId: "user_admin", role: "admin" }),
    ).toEqual({ state: "allowed", userId: "user_admin" });

    expect(
      authorizeOperator({ clerkConfigured: true, userId: "user_role_list", roles: ["viewer", "operator"] }),
    ).toEqual({ state: "allowed", userId: "user_role_list" });
  });

  it("authorizes operators by organization role or permissions", () => {
    expect(
      authorizeOperator({ clerkConfigured: true, userId: "user_org", orgRole: "org:operator" }),
    ).toEqual({ state: "allowed", userId: "user_org" });

    expect(
      authorizeOperator({
        clerkConfigured: true,
        userId: "user_perm",
        orgPermissions: ["org:operator:access"],
      }),
    ).toEqual({ state: "allowed", userId: "user_perm" });
  });

  it("authorizes operators by isOperator flag", () => {
    expect(
      authorizeOperator({ clerkConfigured: true, userId: "user_flagged", isOperator: true }),
    ).toEqual({ state: "allowed", userId: "user_flagged" });
  });

  it("authorizes operators via OPERATOR_USER_IDS environment allowlist", () => {
    const env = { OPERATOR_USER_IDS: "user_whitelisted,user_second" };
    expect(
      authorizeOperator({ clerkConfigured: true, userId: "user_whitelisted", env }),
    ).toEqual({ state: "allowed", userId: "user_whitelisted" });

    expect(
      authorizeOperator({ clerkConfigured: true, userId: "user_not_whitelisted", env }),
    ).toEqual({ state: "denied", code: "unauthorized" });
  });

  it("authorizes operators via OPERATOR_EMAILS environment allowlist", () => {
    const env = { OPERATOR_EMAILS: "operator@repathra.io,admin@repathra.io" };
    expect(
      authorizeOperator({
        clerkConfigured: true,
        userId: "user_clerk_123",
        email: "operator@repathra.io",
        env,
      }),
    ).toEqual({ state: "allowed", userId: "user_clerk_123" });

    expect(
      authorizeOperator({
        clerkConfigured: true,
        userId: "user_clerk_456",
        emails: ["staff@repathra.com", "admin@repathra.io"],
        env,
      }),
    ).toEqual({ state: "allowed", userId: "user_clerk_456" });

    expect(
      authorizeOperator({
        clerkConfigured: true,
        userId: "user_clerk_789",
        email: "visitor@gmail.com",
        env,
      }),
    ).toEqual({ state: "denied", code: "unauthorized" });
  });
});

describe("Sign-in, denial, draft editing, and privacy guarantees", () => {
  it("denies draft saving, publishing, and creation to signed-out users (401 unauthenticated)", async () => {
    const unauthenticated = { clerkConfigured: true, userId: null };

    const saveResult = saveJourneyDraft(
      { commit: vi.fn() },
      {
        ...unauthenticated,
        slug: vendor.slug,
        expectedRevision: 1,
        currentRevision: 1,
        document: vendor.document,
      },
    );
    await expect(saveResult).resolves.toEqual({
      ok: false,
      code: "unauthenticated",
      message: JOURNEY_MESSAGES.unauthenticated,
    });

    const publishResult = publishJourney(
      { commit: vi.fn() },
      {
        ...unauthenticated,
        slug: vendor.slug,
        journeyId,
        expectedRevision: 1,
        currentRevision: 1,
        versions: [],
        document: vendor.document,
        now,
      },
    );
    await expect(publishResult).resolves.toEqual({
      ok: false,
      code: "unauthenticated",
      message: JOURNEY_MESSAGES.unauthenticated,
    });
  });

  it("denies draft saving, publishing, and creation to unauthorized users (403 unauthorized)", async () => {
    const unauthorized = { clerkConfigured: true, userId: "user_regular_visitor" };

    const saveResult = saveJourneyDraft(
      { commit: vi.fn() },
      {
        ...unauthorized,
        slug: vendor.slug,
        expectedRevision: 1,
        currentRevision: 1,
        document: vendor.document,
      },
    );
    await expect(saveResult).resolves.toEqual({
      ok: false,
      code: "unauthorized",
      message: JOURNEY_MESSAGES.unauthorized,
    });

    const publishResult = publishJourney(
      { commit: vi.fn() },
      {
        ...unauthorized,
        slug: vendor.slug,
        journeyId,
        expectedRevision: 1,
        currentRevision: 1,
        versions: [],
        document: vendor.document,
        now,
      },
    );
    await expect(publishResult).resolves.toEqual({
      ok: false,
      code: "unauthorized",
      message: JOURNEY_MESSAGES.unauthorized,
    });
  });

  it("allows draft editing and publishing to explicitly authorized operators", async () => {
    const operator = {
      clerkConfigured: true,
      userId: "user_verified_operator",
      role: "operator" as const,
    };
    const commit = vi.fn().mockResolvedValue({ ok: true, revision: 2 });

    const saveResult = await saveJourneyDraft(
      { commit },
      {
        ...operator,
        slug: vendor.slug,
        expectedRevision: 1,
        currentRevision: 1,
        document: vendor.document,
      },
    );
    expect(saveResult.ok).toBe(true);
    if (saveResult.ok) {
      expect(saveResult.revision).toBe(2);
      expect(saveResult.document.title).toBe(vendor.document.title);
    }
    expect(commit).toHaveBeenCalledWith({
      slug: vendor.slug,
      expectedRevision: 1,
      document: vendor.document,
      actorId: "user_verified_operator",
    });
  });
});


