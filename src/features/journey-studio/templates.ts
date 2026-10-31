import type { JourneyDocument, TemplateKey } from "@/features/journey-studio/model";
import { validateJourney } from "@/features/journey-studio/validate";

export const SANDBOX_NOTICE =
  "Synthetic sandbox. This journey is sample data for operators. It is not a live vendor, customer, or service record.";

export const SYSTEM_SANDBOX_ACTOR = "system:sandbox";

export type SandboxTemplate = {
  slug: TemplateKey;
  templateKey: TemplateKey;
  origin: "sandbox";
  title: string;
  summary: string;
  sandboxNotice: typeof SANDBOX_NOTICE;
  definitionId: string;
  versionId: string;
  document: JourneyDocument;
};

const vendorOnboarding: SandboxTemplate = {
  slug: "vendor-onboarding",
  templateKey: "vendor-onboarding",
  origin: "sandbox",
  title: "Vendor onboarding",
  summary:
    "A synthetic route for bringing a sample vendor onto the desk. No registry, payment, or identity record is created.",
  sandboxNotice: SANDBOX_NOTICE,
  definitionId: "11111111-1111-4111-8111-111111111111",
  versionId: "11111111-1111-4111-8111-111111111201",
  document: {
    title: "Vendor onboarding",
    summary:
      "A synthetic route for bringing a sample vendor onto the desk. No registry, payment, or identity record is created.",
    entryStepId: "collect-legal-name",
    steps: [
      {
        id: "collect-legal-name",
        type: "collect",
        title: "Record the sample legal name",
        instruction: "Capture a fictional legal name. Do not enter a real vendor.",
        fieldKey: "legal_name",
        fieldLabel: "Sample legal name",
        required: true,
        next: "collect-contact",
      },
      {
        id: "collect-contact",
        type: "collect",
        title: "Record the sample contact",
        instruction: "Capture a fictional contact email for the sandbox vendor.",
        fieldKey: "contact_email",
        fieldLabel: "Sample contact email",
        required: true,
        next: "review-profile",
      },
      {
        id: "review-profile",
        type: "review",
        title: "Review the sandbox profile",
        instruction: "Check the sample profile before choosing a risk path. Nothing is filed.",
        next: "decide-risk",
      },
      {
        id: "decide-risk",
        type: "decide",
        title: "Choose a sample risk path",
        instruction: "Branch the sandbox journey. No external risk service is called.",
        outcomes: [
          { id: "standard", label: "Standard sample", next: "handoff-reviewer" },
          { id: "enhanced", label: "Enhanced sample", next: "wait-registry" },
          { id: "decline", label: "Decline sample", next: "complete-declined" },
        ],
      },
      {
        id: "wait-registry",
        type: "wait",
        title: "Wait for a synthetic registry signal",
        instruction: "Pause for the named sandbox signal. No registry is contacted.",
        signalKey: "vendor-registry",
        next: "handoff-compliance",
      },
      {
        id: "handoff-reviewer",
        type: "handoff",
        title: "Hand the sample to a reviewer",
        instruction: "Pass the standard sandbox path to a reviewer role.",
        role: "reviewer",
        next: "complete-accepted",
      },
      {
        id: "handoff-compliance",
        type: "handoff",
        title: "Hand the sample to compliance",
        instruction: "Pass the enhanced sandbox path to a reviewer role.",
        role: "reviewer",
        next: "complete-accepted",
      },
      {
        id: "complete-accepted",
        type: "complete",
        title: "Sample vendor accepted",
        instruction: "The synthetic onboarding route ends as accepted. No vendor was enrolled.",
        outcome: "accepted",
        next: null,
      },
      {
        id: "complete-declined",
        type: "complete",
        title: "Sample vendor declined",
        instruction: "The synthetic onboarding route ends as declined. No vendor was enrolled.",
        outcome: "declined",
        next: null,
      },
    ],
  },
};

const serviceIntake: SandboxTemplate = {
  slug: "service-intake",
  templateKey: "service-intake",
  origin: "sandbox",
  title: "Service intake",
  summary:
    "A synthetic route for accepting a sample service request. No customer case is opened.",
  sandboxNotice: SANDBOX_NOTICE,
  definitionId: "22222222-2222-4222-8222-222222222222",
  versionId: "22222222-2222-4222-8222-222222222201",
  document: {
    title: "Service intake",
    summary:
      "A synthetic route for accepting a sample service request. No customer case is opened.",
    entryStepId: "collect-request",
    steps: [
      {
        id: "collect-request",
        type: "collect",
        title: "Record the sample request",
        instruction: "Capture a fictional service need. Do not enter a live customer request.",
        fieldKey: "request_summary",
        fieldLabel: "Sample request",
        required: true,
        next: "review-intake",
      },
      {
        id: "review-intake",
        type: "review",
        title: "Review the sandbox intake",
        instruction: "Read the sample request before choosing a route. No case is opened.",
        next: "decide-route",
      },
      {
        id: "decide-route",
        type: "decide",
        title: "Choose a sample disposition",
        instruction: "Branch the sandbox intake. No queue outside this journey is updated.",
        outcomes: [
          { id: "proceed", label: "Proceed with sample", next: "handoff-desk" },
          { id: "detail", label: "Ask for sample detail", next: "collect-detail" },
          { id: "decline", label: "Decline sample", next: "complete-declined" },
        ],
      },
      {
        id: "collect-detail",
        type: "collect",
        title: "Record the missing sample detail",
        instruction: "Capture one fictional clarification. Do not contact a customer.",
        fieldKey: "missing_detail",
        fieldLabel: "Sample clarification",
        required: true,
        next: "review-detail",
      },
      {
        id: "review-detail",
        type: "review",
        title: "Review the sample clarification",
        instruction: "Confirm the fictional clarification is enough to continue the sandbox route.",
        next: "handoff-desk",
      },
      {
        id: "handoff-desk",
        type: "handoff",
        title: "Hand the sample to the service desk",
        instruction: "Pass the sandbox request to an operator role.",
        role: "operator",
        next: "complete-accepted",
      },
      {
        id: "complete-accepted",
        type: "complete",
        title: "Sample request accepted",
        instruction: "The synthetic intake ends as accepted. No service case was opened.",
        outcome: "accepted",
        next: null,
      },
      {
        id: "complete-declined",
        type: "complete",
        title: "Sample request declined",
        instruction: "The synthetic intake ends as declined. No service case was opened.",
        outcome: "declined",
        next: null,
      },
    ],
  },
};

export const SANDBOX_TEMPLATES = [vendorOnboarding, serviceIntake] as const;

export const RESERVED_JOURNEY_SLUGS = new Set<string>(SANDBOX_TEMPLATES.map((template) => template.slug));

export function operatorSkeleton(title: string, summary: string): JourneyDocument {
  return {
    title,
    summary,
    entryStepId: "collect-detail",
    steps: [
      {
        id: "collect-detail",
        type: "collect",
        title: "Collect the detail",
        instruction: "Record the detail this journey must keep before it can be interrupted.",
        fieldKey: "detail",
        fieldLabel: "Detail",
        required: true,
        next: "complete-recorded",
      },
      {
        id: "complete-recorded",
        type: "complete",
        title: "Recorded",
        instruction: "The journey has a stored ending and can be published.",
        outcome: "accepted",
        next: null,
      },
    ],
  };
}

for (const template of SANDBOX_TEMPLATES) {
  const validated = validateJourney(template.document);
  if (!validated.ok) {
    throw new Error(`Sandbox template ${template.slug} is not a valid journey.`);
  }
  const skeleton = validateJourney(operatorSkeleton("Operator journey", "A journey defined by an operator."));
  if (!skeleton.ok) {
    throw new Error("The operator skeleton is not a valid journey.");
  }
}
