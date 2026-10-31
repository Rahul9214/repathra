"use client";

import { useState } from "react";
import type { JourneyDocument, JourneyStep } from "@/features/journey-studio/model";

export function RouteDiagram({ document }: { document: JourneyDocument }) {
  const [activeStepId, setActiveStepId] = useState<string | null>(document.steps[0]?.id ?? null);
  const activeStep = document.steps.find((s) => s.id === activeStepId) ?? document.steps[0];

  return (
    <div className="workflow-track" aria-label="Workflow Route Pipeline">
      <div className="track-header">
        <h2>
          <span>Connected Pipeline</span>
        </h2>
        <span className="badge badge-status-frozen">{document.steps.length} Steps</span>
      </div>

      <ol className="track-steps">
        {document.steps.map((step, index) => {
          const isActive = step.id === activeStepId;
          return (
            <li
              key={step.id}
              className={isActive ? "step-node is-active" : "step-node"}
              onClick={() => setActiveStepId(step.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setActiveStepId(step.id);
                }
              }}
              tabIndex={0}
              role="button"
              aria-pressed={isActive}
              aria-label={`Step ${index + 1}: ${step.title}`}
            >
              <div className="step-index-badge">{String(index + 1).padStart(2, "0")}</div>
              <div className="step-node-body">
                <div className="step-node-kicker">
                  <span className={`step-type-pill step-type-${step.type}`}>
                    {step.type}
                  </span>
                  <span className="badge badge-status-frozen">{step.id}</span>
                </div>
                <h3 className="step-node-title">{step.title}</h3>
                <p className="step-node-transition">{step.instruction}</p>

                {step.type === "decide" ? (
                  <div className="branch-list">
                    {step.outcomes.map((outcome) => (
                      <span key={outcome.id} className="branch-pill">
                        <strong>{outcome.label}</strong>
                        <span className="branch-arrow">→</span>
                        <span>{outcome.next}</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="step-node-transition" style={{ marginTop: "0.25rem", color: "var(--copper)" }}>
                    {describeSimpleTransition(step)}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {activeStep ? (
        <div className="inspector-outcomes" style={{ marginTop: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="badge badge-status-draft">Selected Step Detail</span>
            <span className={`step-type-pill step-type-${activeStep.type}`}>{activeStep.type}</span>
          </div>
          <h4 style={{ margin: "0.25rem 0", fontSize: "1rem" }}>{activeStep.title}</h4>
          <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-muted)" }}>{activeStep.instruction}</p>
        </div>
      ) : null}
    </div>
  );
}

function describeSimpleTransition(step: JourneyStep): string {
  if (step.type === "complete") return `Terminal state: ${step.outcome}`;
  if (step.type === "collect") return `Captures "${step.fieldLabel}" → Next: ${step.next}`;
  if (step.type === "wait") return `Awaits signal "${step.signalKey}" → Next: ${step.next}`;
  if (step.type === "handoff") return `Transfers to ${step.role} → Next: ${step.next}`;
  if (step.type === "review") return `Review checkpoint → Next: ${step.next}`;
  if (step.type === "decide") return `Branches: ${step.outcomes.map((o) => o.label).join(", ")}`;
  return "";
}
