"use client";

import { useId, useState } from "react";
import type {
  CompleteOutcome,
  HandoffRole,
  JourneyDocument,
  JourneyStep,
  StepType,
} from "@/features/journey-studio/model";
import {
  IconArrowDown,
  IconArrowUp,
  IconBranchFork,
  IconCheck,
  IconLayers,
  IconPlus,
  IconRoute,
  IconTrash,
  StepTypeIcon,
} from "@/components/studio/icons";

export function StepSettings({
  step,
  stepIndex,
  totalSteps,
  document,
  onChange,
  onMove,
  onRemove,
  readOnly = false,
}: {
  step: JourneyStep;
  stepIndex: number;
  totalSteps: number;
  document: JourneyDocument;
  onChange: (updated: JourneyStep) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  readOnly?: boolean;
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const nameId = useId();
  const instructionId = useId();
  const categoryId = useId();

  // List of other steps available for transition autocomplete
  const otherSteps = document.steps.filter((s) => s.id !== step.id);

  function handleTypeChange(newType: StepType) {
    if (newType === step.type) return;
    const defaultNext = otherSteps[0]?.id ?? "";

    if (newType === "collect") {
      onChange({
        id: step.id,
        type: "collect",
        title: step.title,
        instruction: step.instruction,
        fieldKey: "custom_field",
        fieldLabel: "Field Label",
        required: true,
        next: defaultNext,
      });
    } else if (newType === "review") {
      onChange({
        id: step.id,
        type: "review",
        title: step.title,
        instruction: step.instruction,
        next: defaultNext,
      });
    } else if (newType === "decide") {
      onChange({
        id: step.id,
        type: "decide",
        title: step.title,
        instruction: step.instruction,
        outcomes: [
          { id: "approved", label: "Approved Route", next: defaultNext },
          { id: "declined", label: "Declined Route", next: defaultNext },
        ],
      });
    } else if (newType === "wait") {
      onChange({
        id: step.id,
        type: "wait",
        title: step.title,
        instruction: step.instruction,
        signalKey: "external-signal",
        next: defaultNext,
      });
    } else if (newType === "handoff") {
      onChange({
        id: step.id,
        type: "handoff",
        title: step.title,
        instruction: step.instruction,
        role: "reviewer",
        next: defaultNext,
      });
    } else if (newType === "complete") {
      onChange({
        id: step.id,
        type: "complete",
        title: step.title,
        instruction: step.instruction,
        outcome: "accepted",
        next: null,
      });
    }
  }

  // Validate step completeness
  const isComplete =
    step.type === "decide"
      ? step.outcomes.length > 0 && step.outcomes.every((o) => !!o.next)
      : step.type === "complete"
        ? true
        : !!step.next;

  return (
    <aside className="step-settings" aria-label="Step Settings Panel">
      {/* 05: Restrained Settings Header with Position & Actions */}
      <div className="step-settings-header">
        <div className="settings-header-title">
          <div className="settings-icon-chip">
            <StepTypeIcon type={step.type} />
          </div>
          <div>
            <h3>Step Inspector</h3>
            <div className="settings-header-meta">
              <span className="step-position-pill">
                Step {stepIndex + 1} of {totalSteps}
              </span>
              <span className={`step-valid-pill ${isComplete ? "is-valid" : "is-incomplete"}`}>
                {isComplete ? <IconCheck /> : null}
                {isComplete ? "Configured" : "Route Required"}
              </span>
            </div>
          </div>
        </div>

        {!readOnly ? (
          <div className="settings-header-actions">
            <button
              type="button"
              className="button-icon"
              title="Move Step Up"
              disabled={stepIndex === 0}
              onClick={() => onMove(-1)}
              aria-label="Move step up"
            >
              <IconArrowUp />
            </button>
            <button
              type="button"
              className="button-icon"
              title="Move Step Down"
              disabled={stepIndex === totalSteps - 1}
              onClick={() => onMove(1)}
              aria-label="Move step down"
            >
              <IconArrowDown />
            </button>
            {totalSteps > 1 ? (
              <button
                type="button"
                className="button-icon button-icon-danger"
                title="Remove Step"
                onClick={onRemove}
                aria-label="Delete step"
              >
                <IconTrash />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* 07: Modular Storytelling — Bento Groups */}
      <div className="step-settings-body">
        {/* Module 1: Step Identity & Purpose */}
        <section className="settings-module" aria-label="Step Identity">
          <div className="settings-module-header">
            <IconLayers />
            <span>Step Identity</span>
          </div>

          <label htmlFor={categoryId}>
            Step Category
            <select
              id={categoryId}
              value={step.type}
              disabled={readOnly}
              onChange={(e) => handleTypeChange(e.target.value as StepType)}
            >
              <option value="collect">Form Input (Collect Details)</option>
              <option value="review">Review Checkpoint</option>
              <option value="decide">Decision Point (Branching)</option>
              <option value="wait">Wait for External Signal</option>
              <option value="handoff">Role Handoff</option>
              <option value="complete">Outcome Completion</option>
            </select>
          </label>

          <label htmlFor={nameId}>
            Step Name
            <input
              id={nameId}
              value={step.title}
              disabled={readOnly}
              placeholder="e.g. Collect Contact Information"
              onChange={(e) => onChange({ ...step, title: e.target.value })}
            />
          </label>

          <label htmlFor={instructionId}>
            Instructions & Purpose
            <textarea
              id={instructionId}
              value={step.instruction}
              disabled={readOnly}
              rows={2}
              placeholder="Clear description of what occurs during this step…"
              onChange={(e) => onChange({ ...step, instruction: e.target.value })}
            />
          </label>
        </section>

        {/* Module 2: Routing & State Transitions */}
        <section className="settings-module" aria-label="Step Routing">
          <div className="settings-module-header">
            <IconRoute />
            <span>Workflow Routing</span>
          </div>

          {step.type === "collect" ? (
            <div className="settings-subgroup">
              <label>
                Field Label to Collect
                <input
                  value={step.fieldLabel}
                  disabled={readOnly}
                  placeholder="e.g. Company Tax ID"
                  onChange={(e) => onChange({ ...step, fieldLabel: e.target.value })}
                />
              </label>

              <label className="check" style={{ marginTop: "0.25rem" }}>
                <input
                  type="checkbox"
                  checked={step.required}
                  disabled={readOnly}
                  onChange={(e) => onChange({ ...step, required: e.target.checked })}
                />
                Required for completion
              </label>

              <StepSelector
                label="Downstream Step After Input"
                currentNext={step.next}
                availableSteps={otherSteps}
                readOnly={readOnly}
                onChange={(next) => onChange({ ...step, next })}
              />
            </div>
          ) : null}

          {step.type === "review" ? (
            <div className="settings-subgroup">
              <StepSelector
                label="Downstream Step After Review"
                currentNext={step.next}
                availableSteps={otherSteps}
                readOnly={readOnly}
                onChange={(next) => onChange({ ...step, next })}
              />
            </div>
          ) : null}

          {step.type === "decide" ? (
            <div className="settings-subgroup">
              <div className="branch-manager-header">
                <span className="branch-manager-title">
                  <IconBranchFork />
                  <span>Alternate Decision Routes ({step.outcomes.length})</span>
                </span>
                {!readOnly ? (
                  <button
                    type="button"
                    className="button button-quiet button-sm"
                    onClick={() => {
                      const id = `outcome-${step.outcomes.length + 1}`;
                      const next = otherSteps[0]?.id ?? "";
                      onChange({
                        ...step,
                        outcomes: [
                          ...step.outcomes,
                          { id, label: `Choice ${step.outcomes.length + 1}`, next },
                        ],
                      });
                    }}
                  >
                    <IconPlus />
                    <span>Add Route</span>
                  </button>
                ) : null}
              </div>

              <div className="outcomes-stack">
                {step.outcomes.map((outcome, oIdx) => (
                  <div key={outcome.id || oIdx} className="outcome-row">
                    <div className="outcome-row-inputs">
                      <input
                        value={outcome.label}
                        disabled={readOnly}
                        placeholder="Route Label (e.g. Standard Approval)"
                        onChange={(e) => {
                          const updated = step.outcomes.map((o, idx) =>
                            idx === oIdx ? { ...o, label: e.target.value } : o,
                          );
                          onChange({ ...step, outcomes: updated });
                        }}
                      />

                      <select
                        value={outcome.next}
                        disabled={readOnly}
                        onChange={(e) => {
                          const updated = step.outcomes.map((o, idx) =>
                            idx === oIdx ? { ...o, next: e.target.value } : o,
                          );
                          onChange({ ...step, outcomes: updated });
                        }}
                      >
                        <option value="" disabled>Select destination step…</option>
                        {otherSteps.map((s) => (
                          <option key={s.id} value={s.id}>
                            → {s.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    {!readOnly && step.outcomes.length > 1 ? (
                      <button
                        type="button"
                        className="button-icon button-icon-danger"
                        title="Delete Choice"
                        onClick={() => {
                          const updated = step.outcomes.filter((_, idx) => idx !== oIdx);
                          onChange({ ...step, outcomes: updated });
                        }}
                        aria-label="Delete decision route"
                      >
                        <IconTrash />
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {step.type === "wait" ? (
            <div className="settings-subgroup">
              <label>
                Signal / Event Name
                <input
                  value={step.signalKey}
                  disabled={readOnly}
                  placeholder="e.g. registry-verification"
                  onChange={(e) => onChange({ ...step, signalKey: e.target.value })}
                />
              </label>

              <StepSelector
                label="Downstream Step After Signal"
                currentNext={step.next}
                availableSteps={otherSteps}
                readOnly={readOnly}
                onChange={(next) => onChange({ ...step, next })}
              />
            </div>
          ) : null}

          {step.type === "handoff" ? (
            <div className="settings-subgroup">
              <label>
                Assign to Team Role
                <select
                  value={step.role}
                  disabled={readOnly}
                  onChange={(e) => onChange({ ...step, role: e.target.value as HandoffRole })}
                >
                  <option value="operator">Operator Desk</option>
                  <option value="reviewer">Compliance Reviewer</option>
                  <option value="vendor">Vendor Partner</option>
                  <option value="requester">Service Requester</option>
                </select>
              </label>

              <StepSelector
                label="Downstream Step After Handoff"
                currentNext={step.next}
                availableSteps={otherSteps}
                readOnly={readOnly}
                onChange={(next) => onChange({ ...step, next })}
              />
            </div>
          ) : null}

          {step.type === "complete" ? (
            <div className="settings-subgroup">
              <label>
                Final Outcome Status
                <select
                  value={step.outcome}
                  disabled={readOnly}
                  onChange={(e) => onChange({ ...step, outcome: e.target.value as CompleteOutcome })}
                >
                  <option value="accepted">Accepted / Approved</option>
                  <option value="declined">Declined / Rejected</option>
                  <option value="withdrawn">Withdrawn</option>
                </select>
              </label>
            </div>
          ) : null}
        </section>

        {/* 03: Subtle Staged Disclosure — Collapsible Technical Contract */}
        <section className="settings-advanced-toggle-wrap">
          <button
            type="button"
            className="settings-advanced-toggle"
            onClick={() => setShowAdvanced(!showAdvanced)}
            aria-expanded={showAdvanced}
          >
            <span>{showAdvanced ? "▾ Hide Technical Schema" : "▸ Advanced Technical Contract"}</span>
            <span className="advanced-toggle-badge">{step.id}</span>
          </button>

          {showAdvanced ? (
            <div className="settings-advanced-card">
              <label>
                Step Identifier (Internal Key)
                <input
                  value={step.id}
                  disabled={readOnly}
                  onChange={(e) => onChange({ ...step, id: e.target.value })}
                />
              </label>

              {step.type === "collect" ? (
                <label>
                  Form Field Key (Internal)
                  <input
                    value={step.fieldKey}
                    disabled={readOnly}
                    onChange={(e) => onChange({ ...step, fieldKey: e.target.value })}
                  />
                </label>
              ) : null}

              <div className="contract-inspector-snippet">
                <span className="snippet-label">Runtime Contract Spec</span>
                <code>{`{ "id": "${step.id}", "type": "${step.type}" }`}</code>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </aside>
  );
}

function StepSelector({
  label,
  currentNext,
  availableSteps,
  readOnly,
  onChange,
}: {
  label: string;
  currentNext: string;
  availableSteps: JourneyStep[];
  readOnly: boolean;
  onChange: (next: string) => void;
}) {
  const selectId = useId();

  return (
    <label htmlFor={selectId} style={{ marginTop: "0.5rem" }}>
      {label}
      <select
        id={selectId}
        value={currentNext}
        disabled={readOnly}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="" disabled>
          Select destination step…
        </option>
        {availableSteps.map((s) => (
          <option key={s.id} value={s.id}>
            → {s.title} ({friendlyStepType(s.type)})
          </option>
        ))}
      </select>
    </label>
  );
}

function friendlyStepType(type: JourneyStep["type"]): string {
  switch (type) {
    case "collect":
      return "Form Input";
    case "review":
      return "Review";
    case "decide":
      return "Decision Point";
    case "wait":
      return "Wait Signal";
    case "handoff":
      return "Role Handoff";
    case "complete":
      return "Outcome";
    default:
      return type;
  }
}
