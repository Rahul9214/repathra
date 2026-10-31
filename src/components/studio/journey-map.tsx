"use client";

import { useId, useState } from "react";
import type { JourneyDocument, JourneyStep } from "@/features/journey-studio/model";
import {
  IconActivity,
  IconBranchFork,
  IconCheck,
  IconPlus,
  IconSparkles,
  StepTypeIcon,
} from "@/components/studio/icons";

export function JourneyMap({
  document,
  selectedStepId,
  onSelectStep,
  readOnly = false,
  onAddStep,
}: {
  document: JourneyDocument;
  selectedStepId: string | null;
  onSelectStep?: (stepId: string) => void;
  readOnly?: boolean;
  onAddStep?: () => void;
}) {
  const mapId = useId();
  const [hoveredBranchTarget, setHoveredBranchTarget] = useState<string | null>(null);

  const stepsById = new Map<string, JourneyStep>(
    document.steps.map((s) => [s.id, s]),
  );


  // Separate active workflow steps from terminal outcomes
  const workflowSteps = document.steps.filter((s) => s.type !== "complete");
  const terminalSteps = document.steps.filter((s) => s.type === "complete");

  // Compute incoming transitions truthfully from the validated graph
  const incomingMap = new Map<string, Array<{ fromTitle: string; label?: string }>>();
  for (const step of document.steps) {
    if (step.type === "decide") {
      for (const outcome of step.outcomes) {
        if (outcome.next) {
          if (!incomingMap.has(outcome.next)) incomingMap.set(outcome.next, []);
          incomingMap.get(outcome.next)!.push({
            fromTitle: step.title,
            label: outcome.label,
          });
        }
      }
    } else if (step.type !== "complete" && step.next) {
      if (!incomingMap.has(step.next)) incomingMap.set(step.next, []);
      incomingMap.get(step.next)!.push({ fromTitle: step.title });
    }
  }

  const decisionCount = workflowSteps.filter((s) => s.type === "decide").length;
  const outcomeCount = terminalSteps.length;
  const selectedStep = stepsById.get(selectedStepId ?? "");

  return (
    <div className="journey-map" role="region" aria-label="Workflow Journey Map">
      {/* Telemetry Header Bar */}
      <div className="journey-map-toolbar">
        <div className="map-toolbar-title">
          <span className="map-indicator-dot" />
          <span className="map-title-text">Workflow Architecture Map</span>
          <div className="map-telemetry-strip" aria-label="Workflow Metrics">
            <span className="telemetry-pill">
              <IconActivity />
              <strong>{document.steps.length}</strong> Steps
            </span>
            {decisionCount > 0 ? (
              <span className="telemetry-pill">
                <IconBranchFork />
                <strong>{decisionCount}</strong> {decisionCount === 1 ? "Fork" : "Forks"}
              </span>
            ) : null}
            <span className="telemetry-pill">
              <IconCheck />
              <strong>{outcomeCount}</strong> {outcomeCount === 1 ? "Outcome" : "Outcomes"}
            </span>
            <span className="telemetry-pill is-status">
              <IconSparkles />
              Graph Validated
            </span>
          </div>
        </div>

        {!readOnly && onAddStep ? (
          <button
            type="button"
            className="button button-secondary button-sm"
            onClick={onAddStep}
          >
            <IconPlus />
            <span>Add Step</span>
          </button>
        ) : null}
      </div>

      {/* Main Workflow Graph Canvas */}
      <div className="map-canvas">
        <ol className="map-flow" id={mapId}>
          {workflowSteps.map((step, index) => {
            const isSelected = step.id === selectedStepId;
            const isEntry = step.id === document.entryStepId || index === 0;
            const isDecide = step.type === "decide";
            const isHoveredTarget = hoveredBranchTarget === step.id;

            // Direct downstream highlight based on actual transitions
            const isDirectDownstream =
              selectedStep &&
              selectedStep.type !== "decide" &&
              selectedStep.type !== "complete" &&
              selectedStep.next === step.id;

            // Check actual transition for non-decide step
            const targetId = !isDecide ? step.next : null;
            const targetStep = targetId ? stepsById.get(targetId) : null;
            const isTargetTerminal = targetStep?.type === "complete";

            // Only draw a downward arrow if targetId is directly the subsequent step in workflowSteps
            const nextWorkflowStep = workflowSteps[index + 1];
            const isDirectSequential =
              !isDecide &&
              nextWorkflowStep &&
              targetId === nextWorkflowStep.id;

            return (
              <li
                key={step.id}
                className={`map-node-wrapper ${isSelected ? "is-selected" : ""} ${
                  isDecide ? "is-decide-node" : ""
                } ${isHoveredTarget ? "is-highlighted-branch-target" : ""} ${
                  isDirectDownstream ? "is-downstream-target" : ""
                }`}
              >
                {/* Node Card */}
                <div
                  className={`map-node ${isSelected ? "is-active" : ""}`}
                  onClick={() => onSelectStep?.(step.id)}
                  tabIndex={0}
                  role="button"
                  aria-pressed={isSelected}
                  aria-label={`Step ${index + 1}: ${step.title}`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectStep?.(step.id);
                    }
                  }}
                >
                  <div className="map-node-icon-wrap">
                    <StepTypeIcon type={step.type} className="map-node-icon" />
                  </div>

                  <div className="map-node-content">
                    <div className="map-node-meta">
                      <span className="map-node-type-label">
                        {friendlyStepType(step.type)}
                      </span>
                      {isEntry ? <span className="entry-tag">Entry</span> : null}
                      {isSelected ? (
                        <span className="active-focus-tag">Selected</span>
                      ) : null}
                    </div>

                    <h3 className="map-node-title">{step.title}</h3>

                    {/* Transition Route Cues (Truthful Graph Targets) */}
                    {!isDecide && targetStep ? (
                      isTargetTerminal ? (
                        <div className="map-node-transition-cue is-terminal-cue">
                          <span>Transitions to:</span>
                          <button
                            type="button"
                            className="cue-terminal-link"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectStep?.(targetStep.id);
                            }}
                            title={`Jump to outcome: ${targetStep.title}`}
                          >
                            <strong>{targetStep.title}</strong>
                            <span className={`outcome-chip outcome-${targetStep.outcome}`}>
                              {targetStep.outcome}
                            </span>
                          </button>
                        </div>
                      ) : !isDirectSequential ? (
                        <div className="map-node-transition-cue is-jump-cue">
                          <span>Transitions to:</span>
                          <button
                            type="button"
                            className="cue-jump-link"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectStep?.(targetStep.id);
                            }}
                            title={`Jump to step: ${targetStep.title}`}
                          >
                            <strong>{targetStep.title}</strong>
                          </button>
                        </div>
                      ) : null
                    ) : null}
                  </div>

                  <div className="map-node-badge-index">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                </div>

                {/* Decision Branches: Real Destinations Displayed */}
                {isDecide ? (
                  <div className="map-branches-container" aria-label="Decision Routes">
                    <div className="map-branches-fork-label">
                      <IconBranchFork className="branch-fork-icon" />
                      <span>Decision Routes ({step.outcomes.length})</span>
                    </div>

                    <div className="map-branches-grid">
                      {step.outcomes.map((outcome, outcomeIdx) => {
                        const destStep = outcome.next ? stepsById.get(outcome.next) : null;
                        const isDestTerminal = destStep?.type === "complete";

                        return (
                          <button
                            key={outcome.id || outcomeIdx}
                            type="button"
                            className={`map-branch-card ${
                              isDestTerminal ? "is-branch-to-terminal" : ""
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (outcome.next) onSelectStep?.(outcome.next);
                            }}
                            onMouseEnter={() => setHoveredBranchTarget(outcome.next || null)}
                            onMouseLeave={() => setHoveredBranchTarget(null)}
                            title={`Navigate to: ${destStep?.title || outcome.next}`}
                          >
                            <div className="branch-card-header">
                              <span className="branch-card-badge">
                                Route {String.fromCharCode(65 + outcomeIdx)}
                              </span>
                              <span className="branch-card-target">
                                → {destStep ? destStep.title : "Unassigned"}
                              </span>
                            </div>
                            <span className="branch-card-label">{outcome.label}</span>
                            {isDestTerminal && destStep ? (
                              <span
                                className={`branch-terminal-badge outcome-${destStep.outcome}`}
                              >
                                Outcome · {destStep.outcome}
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {/* Downward Connector Line: ONLY rendered if targetId === nextWorkflowStep.id */}
                {isDirectSequential ? (
                  <div
                    className={`map-connector-line ${
                      isSelected ? "is-source-active" : ""
                    } ${isDirectDownstream ? "is-target-active" : ""}`}
                    aria-hidden="true"
                  >
                    <svg className="connector-svg" viewBox="0 0 24 32" fill="none">
                      <line
                        x1="12"
                        y1="0"
                        x2="12"
                        y2="24"
                        className="connector-path"
                      />
                      <polygon
                        points="8,20 12,28 16,20"
                        className="connector-arrow-head"
                      />
                    </svg>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>

        {/* Terminal Destinations: Completely Separate, Mutually Exclusive, Zero False Connectors */}
        {terminalSteps.length > 0 ? (
          <div
            className="map-terminal-section"
            role="region"
            aria-label="Terminal Destinations"
          >
            <div className="terminal-section-header">
              <div className="terminal-header-title">
                <span className="terminal-indicator-dot" />
                <h4>Terminal Outcomes ({terminalSteps.length})</h4>
              </div>
              <span className="terminal-header-badge">
                Mutually Exclusive Destinations
              </span>
            </div>

            <div className="map-terminal-grid">
              {terminalSteps.map((termStep) => {
                const isSelected = termStep.id === selectedStepId;
                const isHoveredTarget = hoveredBranchTarget === termStep.id;
                const inflows = incomingMap.get(termStep.id) || [];
                const isAccepted = termStep.outcome === "accepted";
                const isDeclined = termStep.outcome === "declined";

                return (
                  <div
                    key={termStep.id}
                    className={`map-terminal-card ${isSelected ? "is-active" : ""} ${
                      isAccepted
                        ? "is-outcome-accepted"
                        : isDeclined
                          ? "is-outcome-declined"
                          : ""
                    } ${isHoveredTarget ? "is-highlighted-branch-target" : ""}`}
                    onClick={() => onSelectStep?.(termStep.id)}
                    tabIndex={0}
                    role="button"
                    aria-pressed={isSelected}
                    aria-label={`Terminal outcome: ${termStep.title}`}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelectStep?.(termStep.id);
                      }
                    }}
                  >
                    <div className="terminal-card-top">
                      <span className={`terminal-outcome-pill outcome-${termStep.outcome}`}>
                        <IconCheck />
                        <span>Outcome: {termStep.outcome}</span>
                      </span>
                      {isSelected ? (
                        <span className="active-focus-tag">Selected</span>
                      ) : null}
                    </div>

                    <h3 className="terminal-card-title">{termStep.title}</h3>

                    <div className="terminal-inflow">
                      <span className="inflow-label">Reached from:</span>
                      {inflows.length === 0 ? (
                        <span className="inflow-empty">No incoming transitions</span>
                      ) : (
                        <ul className="inflow-list">
                          {inflows.map((inf, iIdx) => (
                            <li key={iIdx}>
                              {inf.fromTitle}
                              {inf.label ? ` (${inf.label})` : ""}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
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
      return "Terminal Outcome";
    default:
      return type;
  }
}
