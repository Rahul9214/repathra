import { describe, expect, it } from "vitest";

import type { JourneyDocument } from "@/features/journey-studio/model";
import { evaluateTransition, getInitialRunState } from "@/features/resume-anywhere/engine";
import { RUN_MESSAGES } from "@/features/resume-anywhere/messages";
import {
  executeStepSchema,
  startRunSchema,
} from "@/features/resume-anywhere/schema";

const sampleDocument: JourneyDocument = {
  title: "Vendor Onboarding",
  summary: "Structured intake for third-party service providers.",
  entryStepId: "step-collect-info",
  steps: [
    {
      id: "step-collect-info",
      type: "collect",
      title: "Vendor Identification",
      instruction: "Provide your registered entity name.",
      fieldKey: "legal_name",
      fieldLabel: "Legal Entity Name",
      required: true,
      next: "step-review-terms",
    },
    {
      id: "step-review-terms",
      type: "review",
      title: "Compliance Terms",
      instruction: "Review statutory standards and confirm acknowledgment.",
      next: "step-risk-tier",
    },
    {
      id: "step-risk-tier",
      type: "decide",
      title: "Risk Evaluation",
      instruction: "Categorize the relationship profile.",
      outcomes: [
        { id: "low-risk", label: "Standard Vendor", next: "step-wait-sig" },
        { id: "high-risk", label: "Sensitive Access", next: "step-security-handoff" },
      ],
    },
    {
      id: "step-wait-sig",
      type: "wait",
      title: "Registry Webhook",
      instruction: "Awaiting automatic verification signal.",
      signalKey: "vendor-registry-verified",
      next: "step-done",
    },
    {
      id: "step-security-handoff",
      type: "handoff",
      title: "Security Approval",
      instruction: "Routed to InfoSec desk for formal clearance.",
      role: "reviewer",
      next: "step-done",
    },
    {
      id: "step-done",
      type: "complete",
      title: "Intake Complete",
      instruction: "Vendor intake has finished.",
      outcome: "accepted",
      next: null,
    },
  ],
};

describe("Resume Anywhere Transition Engine", () => {
  it("determines initial state from entry step", () => {
    const active = getInitialRunState(sampleDocument);
    expect(active.currentStepId).toBe("step-collect-info");
    expect(active.status).toBe("active");
    expect(active.completedOutcome).toBeNull();

    const waitDoc: JourneyDocument = {
      ...sampleDocument,
      entryStepId: "step-wait-sig",
    };
    const paused = getInitialRunState(waitDoc);
    expect(paused.currentStepId).toBe("step-wait-sig");
    expect(paused.status).toBe("paused");

    const completeDoc: JourneyDocument = {
      ...sampleDocument,
      entryStepId: "step-done",
    };
    const completed = getInitialRunState(completeDoc);
    expect(completed.currentStepId).toBe("step-done");
    expect(completed.status).toBe("completed");
    expect(completed.completedOutcome).toBe("accepted");
  });

  describe("collect step", () => {
    it("advances when required field is provided and trims whitespace", () => {
      const result = evaluateTransition({
        document: sampleDocument,
        currentStepId: "step-collect-info",
        status: "active",
        collectedValues: {},
        completedStepIds: [],
        action: { type: "collect", value: "  Acme Corp  " },
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.nextStepId).toBe("step-review-terms");
      expect(result.nextStatus).toBe("active");
      expect(result.collectedValues).toEqual({ legal_name: "Acme Corp" });
      expect(result.completedStepIds).toEqual(["step-collect-info"]);
    });

    it("rejects when required field is empty or whitespace", () => {
      const emptyResult = evaluateTransition({
        document: sampleDocument,
        currentStepId: "step-collect-info",
        status: "active",
        collectedValues: {},
        completedStepIds: [],
        action: { type: "collect", value: "   " },
      });

      expect(emptyResult.ok).toBe(false);
      if (emptyResult.ok) return;
      expect(emptyResult.code).toBe("missing_required_field");
      expect(emptyResult.message).toBe(RUN_MESSAGES.missing_required_field);
    });

    it("rejects wrong action type submitted on collect step", () => {
      const result = evaluateTransition({
        document: sampleDocument,
        currentStepId: "step-collect-info",
        status: "active",
        collectedValues: {},
        completedStepIds: [],
        action: { type: "review", acknowledged: true },
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("invalid_step_type");
    });
  });

  describe("review step", () => {
    it("advances when explicitly acknowledged", () => {
      const result = evaluateTransition({
        document: sampleDocument,
        currentStepId: "step-review-terms",
        status: "active",
        collectedValues: { legal_name: "Acme Corp" },
        completedStepIds: ["step-collect-info"],
        action: { type: "review", acknowledged: true },
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.nextStepId).toBe("step-risk-tier");
      expect(result.nextStatus).toBe("active");
      expect(result.collectedValues).toEqual({ legal_name: "Acme Corp" });
      expect(result.completedStepIds).toEqual(["step-collect-info", "step-review-terms"]);
    });

    it("rejects when acknowledged is false", () => {
      const result = evaluateTransition({
        document: sampleDocument,
        currentStepId: "step-review-terms",
        status: "active",
        collectedValues: {},
        completedStepIds: [],
        action: { type: "review", acknowledged: false },
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("review_acknowledgment_required");
      expect(result.message).toBe(RUN_MESSAGES.review_acknowledgment_required);
    });
  });

  describe("decide step", () => {
    it("advances to outcome target and sets paused status if target is wait", () => {
      const result = evaluateTransition({
        document: sampleDocument,
        currentStepId: "step-risk-tier",
        status: "active",
        collectedValues: { legal_name: "Acme Corp" },
        completedStepIds: ["step-collect-info", "step-review-terms"],
        action: { type: "decide", outcomeId: "low-risk" },
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.nextStepId).toBe("step-wait-sig");
      expect(result.nextStatus).toBe("paused");
      expect(result.completedStepIds).toContain("step-risk-tier");
    });

    it("advances to outcome target and sets paused status if target is handoff", () => {
      const result = evaluateTransition({
        document: sampleDocument,
        currentStepId: "step-risk-tier",
        status: "active",
        collectedValues: {},
        completedStepIds: [],
        action: { type: "decide", outcomeId: "high-risk" },
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.nextStepId).toBe("step-security-handoff");
      expect(result.nextStatus).toBe("paused");
    });

    it("rejects unknown outcome id", () => {
      const result = evaluateTransition({
        document: sampleDocument,
        currentStepId: "step-risk-tier",
        status: "active",
        collectedValues: {},
        completedStepIds: [],
        action: { type: "decide", outcomeId: "non-existent-choice" },
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("invalid_decision_outcome");
      expect(result.message).toBe(RUN_MESSAGES.invalid_decision_outcome);
    });
  });

  describe("wait and handoff enforcement", () => {
    it("strictly rejects client attempts to advance a wait step manually", () => {
      const result = evaluateTransition({
        document: sampleDocument,
        currentStepId: "step-wait-sig",
        status: "paused",
        collectedValues: {},
        completedStepIds: [],
        action: { type: "review", acknowledged: true },
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("step_paused_waiting_for_signal");
      expect(result.message).toBe(RUN_MESSAGES.step_paused_waiting_for_signal);
    });

    it("strictly rejects client attempts to advance a handoff step manually", () => {
      const result = evaluateTransition({
        document: sampleDocument,
        currentStepId: "step-security-handoff",
        status: "paused",
        collectedValues: {},
        completedStepIds: [],
        action: { type: "review", acknowledged: true },
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("step_paused_waiting_for_handoff");
      expect(result.message).toBe(RUN_MESSAGES.step_paused_waiting_for_handoff);
    });
  });

  describe("complete step terminality", () => {
    it("marks terminal outcome when transitioning to complete", () => {
      const directCompleteDoc: JourneyDocument = {
        title: "Fast Review",
        summary: "Fast",
        entryStepId: "step-ack",
        steps: [
          {
            id: "step-ack",
            type: "review",
            title: "Acceptance",
            instruction: "Confirm approval",
            next: "step-final",
          },
          {
            id: "step-final",
            type: "complete",
            title: "Finalized",
            instruction: "Done",
            outcome: "accepted",
            next: null,
          },
        ],
      };

      const result = evaluateTransition({
        document: directCompleteDoc,
        currentStepId: "step-ack",
        status: "active",
        collectedValues: {},
        completedStepIds: [],
        action: { type: "review", acknowledged: true },
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.nextStepId).toBe("step-final");
      expect(result.nextStatus).toBe("completed");
      expect(result.completedOutcome).toBe("accepted");
    });

    it("rejects transition attempts on already completed runs", () => {
      const result = evaluateTransition({
        document: sampleDocument,
        currentStepId: "step-done",
        status: "completed",
        collectedValues: {},
        completedStepIds: ["step-done"],
        action: { type: "review", acknowledged: true },
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("run_already_completed");
    });
  });

  describe("Zod input schemas", () => {
    it("validates startRunSchema", () => {
      const valid = startRunSchema.safeParse({
        journeySlug: "vendor-onboarding",
        versionNumber: 1,
        idempotencyKey: "idem-1234",
      });
      expect(valid.success).toBe(true);

      const invalidVersion = startRunSchema.safeParse({
        journeySlug: "vendor-onboarding",
        versionNumber: 0,
      });
      expect(invalidVersion.success).toBe(false);

      const invalidSlug = startRunSchema.safeParse({
        journeySlug: "INVALID SLUG",
        versionNumber: 1,
      });
      expect(invalidSlug.success).toBe(false);
    });

    it("validates executeStepSchema", () => {
      const validCollect = executeStepSchema.safeParse({
        expectedRevision: 1,
        action: { type: "collect", value: "Valid Name" },
      });
      expect(validCollect.success).toBe(true);

      const validReview = executeStepSchema.safeParse({
        expectedRevision: 2,
        action: { type: "review", acknowledged: true },
      });
      expect(validReview.success).toBe(true);

      const validDecide = executeStepSchema.safeParse({
        expectedRevision: 3,
        action: { type: "decide", outcomeId: "low-risk" },
      });
      expect(validDecide.success).toBe(true);

      const invalidRevision = executeStepSchema.safeParse({
        expectedRevision: 0,
        action: { type: "review", acknowledged: true },
      });
      expect(invalidRevision.success).toBe(false);
    });
  });
});
