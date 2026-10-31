"use client";

import { useId, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { executeStepAction } from "@/app/runs/actions";
import {
  IconActivity,
  IconArrowRight,
  IconCheck,
  IconLayers,
  IconSparkles,
} from "@/components/studio/icons";
import type {
  CollectStep,
  CompleteStep,
  DecideStep,
  HandoffStep,
  WaitStep,
} from "@/features/journey-studio/model";
import type { RunDetail, RunRecord, StepAction } from "@/features/resume-anywhere/model";

export function RunRunner({ initialDetail }: { initialDetail: RunDetail }) {
  const router = useRouter();
  const [detail, setDetail] = useState<RunDetail>(initialDetail);
  const [isPending, startTransition] = useTransition();

  const [collectInput, setCollectInput] = useState<string>(() => {
    if (detail.currentStep.type === "collect") {
      return detail.run.collectedValues[detail.currentStep.fieldKey] ?? "";
    }
    return "";
  });

  const [reviewAck, setReviewAck] = useState<boolean>(false);
  const [selectedOutcomeId, setSelectedOutcomeId] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [conflictDetected, setConflictDetected] = useState<boolean>(false);

  const formInputId = useId();
  const ackCheckId = useId();

  const { run, document, currentStep, events } = detail;
  const isSandbox = run.journeyOrigin === "sandbox";
  const isCompleted = run.status === "completed";

  const totalSteps = document.steps.length;
  const currentStepIndex = document.steps.findIndex((s) => s.id === currentStep.id);
  const displayIndex = currentStepIndex >= 0 ? currentStepIndex + 1 : 1;
  const progressPercent = Math.min(
    100,
    Math.round(((run.completedStepIds.length + (isCompleted ? 1 : 0)) / totalSteps) * 100),
  );

  async function handleStepSubmit(action: StepAction) {
    setErrorMessage(null);
    setConflictDetected(false);

    startTransition(async () => {
      try {
        const res = await executeStepAction(run.id, run.revision, action);
        if (!res.ok) {
          if (res.code === "revision_conflict") {
            setConflictDetected(true);
            setErrorMessage(
              "Conflict detected: This run was updated by another session or device. Please refresh to load the latest state.",
            );
          } else {
            setErrorMessage(res.message);
          }
          return;
        }

        // Successfully advanced step! Update local state
        const updatedRun: RunRecord = res.run;
        const nextStep = document.steps.find((s) => s.id === updatedRun.currentStepId) ?? currentStep;

        setDetail((prev) => ({
          ...prev,
          run: updatedRun,
          currentStep: nextStep,
        }));

        // Reset step form state for the next step
        if (nextStep.type === "collect") {
          setCollectInput(updatedRun.collectedValues[nextStep.fieldKey] ?? "");
        } else {
          setCollectInput("");
        }
        setReviewAck(false);
        setSelectedOutcomeId("");

        // Refresh router in background to sync server component cache
        router.refresh();
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "Failed to execute step.");
      }
    });
  }

  function handleReload() {
    window.location.reload();
  }

  return (
    <div className="runner-workspace">
      {/* Breadcrumb & Navigation */}
      <header className="workspace-header">
        <div className="workspace-header-left">
          <nav className="breadcrumbs" aria-label="Breadcrumb">
            <Link href="/runs">My Journeys</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{run.journeyTitle}</span>
          </nav>

          <div className="workspace-title-row">
            <h1>{run.journeyTitle}</h1>
            <span className="badge badge-status-published">
              Version {run.versionNumber} · Immutable
            </span>
            {isSandbox ? <span className="badge badge-sandbox">Sandbox</span> : null}
            <span className={`run-status-pill is-${run.status}`}>
              <span className="status-dot" />
              <span>{run.status === "active" ? "Active" : run.status === "paused" ? "Paused" : "Completed"}</span>
            </span>
          </div>

          <p className="workspace-summary">{document.summary}</p>
        </div>

        <div className="workspace-header-actions">
          <div className="runner-sync-pill">
            <IconActivity />
            <span>Saved to DB · Rev {run.revision}</span>
          </div>
          <Link href="/runs" className="button button-secondary button-sm">
            <span>All Journeys</span>
          </Link>
        </div>
      </header>

      {/* Sandbox Notice Banner if applicable */}
      {isSandbox && run.sandboxNotice ? (
        <div className="sandbox-banner" style={{ marginBottom: "1.25rem" }} role="status">
          <IconSparkles />
          <span>{run.sandboxNotice}</span>
        </div>
      ) : null}

      {/* Stepper Progress Bar */}
      <div className="runner-stepper-container" aria-label="Workflow progress">
        <div className="runner-stepper-header">
          <span className="stepper-step-indicator">
            Step {displayIndex} of {totalSteps}: <strong>{currentStep.title}</strong>
          </span>
          <span className="stepper-percent-indicator">{progressPercent}% complete</span>
        </div>
        <div className="progress-bar-track">
          <div
            className={`progress-bar-fill is-${run.status}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Conflict Alert Banner */}
      {conflictDetected ? (
        <div className="conflict-banner" role="alert">
          <div>
            <strong>Concurrency Conflict:</strong> Another browser session or device has updated this journey to a newer revision.
          </div>
          <button type="button" className="button button-primary button-sm" onClick={handleReload}>
            Reload Latest State
          </button>
        </div>
      ) : null}

      {/* Two-Column Execution Layout */}
      <div className="runner-layout-grid">
        {/* Main Column: Step Execution Card */}
        <section className="runner-step-card" aria-labelledby="step-card-heading">
          <div className="step-card-header">
            <div className="step-type-pill">
              {currentStep.type === "collect" ? (
                <span className="badge badge-operator">Step {displayIndex} · Collect Input</span>
              ) : currentStep.type === "review" ? (
                <span className="badge badge-status-draft">Step {displayIndex} · Review & Acknowledge</span>
              ) : currentStep.type === "decide" ? (
                <span className="badge badge-operator">Step {displayIndex} · Decision Fork</span>
              ) : currentStep.type === "wait" ? (
                <span className="badge badge-status-draft">Step {displayIndex} · Paused (Signal)</span>
              ) : currentStep.type === "handoff" ? (
                <span className="badge badge-status-draft">Step {displayIndex} · Paused (Handoff)</span>
              ) : (
                <span className="badge badge-status-published">Step {displayIndex} · Sealed Outcome</span>
              )}
            </div>
            <h2 id="step-card-heading">{currentStep.title}</h2>
            <p className="step-instruction">{currentStep.instruction}</p>
          </div>

          <div className="step-card-body">
            {/* 1. COLLECT STEP */}
            {currentStep.type === "collect" ? (
              <form
                className="runner-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleStepSubmit({ type: "collect", value: collectInput });
                }}
              >
                <label htmlFor={formInputId} className="runner-field-label">
                  <span>{(currentStep as CollectStep).fieldLabel}</span>
                  {(currentStep as CollectStep).required ? (
                    <span className="field-required-marker" title="Required">*</span>
                  ) : (
                    <span className="field-optional-marker">(Optional)</span>
                  )}
                </label>
                <input
                  id={formInputId}
                  type="text"
                  className="input-field"
                  value={collectInput}
                  onChange={(e) => setCollectInput(e.target.value)}
                  placeholder={`Enter ${(currentStep as CollectStep).fieldLabel.toLowerCase()}…`}
                  required={(currentStep as CollectStep).required}
                  disabled={isPending}
                  autoFocus
                />

                {errorMessage ? (
                  <p className="runner-error-message" role="alert">
                    {errorMessage}
                  </p>
                ) : null}

                <div className="runner-actions">
                  <button
                    type="submit"
                    className="button button-primary"
                    disabled={isPending}
                  >
                    <span>{isPending ? "Persisting step…" : "Save & Continue"}</span>
                    <IconArrowRight />
                  </button>
                </div>
              </form>
            ) : null}

            {/* 2. REVIEW STEP */}
            {currentStep.type === "review" ? (
              <form
                className="runner-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleStepSubmit({ type: "review", acknowledged: reviewAck });
                }}
              >
                <div className="review-dossier-panel">
                  <h3>Collected Verification Data</h3>
                  {Object.keys(run.collectedValues).length === 0 ? (
                    <p className="meta">No preliminary values were required in prior steps.</p>
                  ) : (
                    <dl className="review-dl">
                      {Object.entries(run.collectedValues).map(([key, value]) => (
                        <div key={key} className="review-dl-row">
                          <dt>{key.replace(/_/g, " ")}</dt>
                          <dd>{value || <span className="meta">None provided</span>}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>

                <div className="review-acknowledgment-box">
                  <label htmlFor={ackCheckId} className="checkbox-label">
                    <input
                      id={ackCheckId}
                      type="checkbox"
                      checked={reviewAck}
                      onChange={(e) => setReviewAck(e.target.checked)}
                      disabled={isPending}
                    />
                    <span>I have reviewed the information above and acknowledge these terms to proceed.</span>
                  </label>
                </div>

                {errorMessage ? (
                  <p className="runner-error-message" role="alert">
                    {errorMessage}
                  </p>
                ) : null}

                <div className="runner-actions">
                  <button
                    type="submit"
                    className="button button-primary"
                    disabled={isPending || !reviewAck}
                  >
                    <span>{isPending ? "Recording acknowledgment…" : "Acknowledge & Proceed"}</span>
                    <IconArrowRight />
                  </button>
                </div>
              </form>
            ) : null}

            {/* 3. DECIDE STEP */}
            {currentStep.type === "decide" ? (
              <form
                className="runner-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!selectedOutcomeId) {
                    setErrorMessage("Please choose a decision outcome before proceeding.");
                    return;
                  }
                  handleStepSubmit({ type: "decide", outcomeId: selectedOutcomeId });
                }}
              >
                <div className="decision-choices-grid" role="radiogroup" aria-label="Decision choices">
                  {(currentStep as DecideStep).outcomes.map((outcome) => {
                    const isSelected = selectedOutcomeId === outcome.id;
                    return (
                      <button
                        key={outcome.id}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        className={`decision-card ${isSelected ? "is-selected" : ""}`}
                        onClick={() => setSelectedOutcomeId(outcome.id)}
                        disabled={isPending}
                      >
                        <div className="decision-radio-circle">
                          {isSelected ? <span className="decision-radio-inner" /> : null}
                        </div>
                        <div className="decision-card-text">
                          <span className="decision-label">{outcome.label}</span>
                          <span className="decision-target">Transitions to: {outcome.next}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {errorMessage ? (
                  <p className="runner-error-message" role="alert">
                    {errorMessage}
                  </p>
                ) : null}

                <div className="runner-actions">
                  <button
                    type="submit"
                    className="button button-primary"
                    disabled={isPending || !selectedOutcomeId}
                  >
                    <span>{isPending ? "Executing decision…" : "Submit Decision"}</span>
                    <IconArrowRight />
                  </button>
                </div>
              </form>
            ) : null}

            {/* 4. WAIT STEP (Paused) */}
            {currentStep.type === "wait" ? (
              <div className="paused-state-panel">
                <div className="paused-header">
                  <span className="badge badge-status-draft">
                    <IconActivity /> Paused: Awaiting Signal
                  </span>
                  <span className="paused-key-code">{(currentStep as WaitStep).signalKey}</span>
                </div>
                <h3>Deterministic Wait Gate</h3>
                <p>
                  This workflow is paused waiting for an incoming external signal with key <code>{(currentStep as WaitStep).signalKey}</code> from the Live Signal Inbox.
                </p>
                <p className="meta">
                  To protect audit integrity, wait steps cannot be bypassed or simulated. All data collected so far is safely preserved in PostgreSQL.
                </p>

                <div className="paused-actions">
                  <button type="button" className="button button-secondary button-sm" onClick={handleReload}>
                    Check for Signal
                  </button>
                  <Link href="/runs" className="button button-quiet button-sm">
                    Return to My Journeys
                  </Link>
                </div>
              </div>
            ) : null}

            {/* 5. HANDOFF STEP (Paused) */}
            {currentStep.type === "handoff" ? (
              <div className="paused-state-panel">
                <div className="paused-header">
                  <span className="badge badge-operator">
                    <IconLayers /> Paused: Awaiting Handoff
                  </span>
                  <span className="paused-key-code">Target Role: {(currentStep as HandoffStep).role}</span>
                </div>
                <h3>Authorized Handoff Required</h3>
                <p>
                  This workflow has reached a formal handoff point and is routed to the <strong>{(currentStep as HandoffStep).role}</strong> desk for external clearance.
                </p>
                <p className="meta">
                  To protect audit integrity, authorized handoffs cannot be faked or approved by standard users. Progress is permanently preserved and will resume once authorized.
                </p>

                <div className="paused-actions">
                  <button type="button" className="button button-secondary button-sm" onClick={handleReload}>
                    Check Handoff Status
                  </button>
                  <Link href="/runs" className="button button-quiet button-sm">
                    Return to My Journeys
                  </Link>
                </div>
              </div>
            ) : null}

            {/* 6. COMPLETE STEP */}
            {currentStep.type === "complete" ? (
              <div className="complete-state-panel">
                <div className="complete-badge-row">
                  <span className="badge badge-status-published">
                    <IconCheck /> Journey Completed
                  </span>
                  <span className="badge-custom">
                    Outcome: {(currentStep as CompleteStep).outcome}
                  </span>
                </div>

                <h3>Workflow Concluded Successfully</h3>
                <p>
                  This journey has completed its deterministic route and is sealed. No further step transitions can be made on this run.
                </p>

                <div className="complete-summary-box">
                  <h4>Recorded Journey Data</h4>
                  {Object.keys(run.collectedValues).length === 0 ? (
                    <p className="meta">No collected data values.</p>
                  ) : (
                    <dl className="review-dl">
                      {Object.entries(run.collectedValues).map(([key, value]) => (
                        <div key={key} className="review-dl-row">
                          <dt>{key.replace(/_/g, " ")}</dt>
                          <dd>{value}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>

                <div className="complete-actions">
                  <Link href="/runs" className="button button-primary">
                    <span>Back to My Journeys</span>
                    <IconArrowRight />
                  </Link>
                  <Link href={`/journeys/${run.journeySlug}/versions/${run.versionNumber}`} className="button button-secondary">
                    View Published Blueprint
                  </Link>
                </div>
              </div>
            ) : null}
          </div>

          <footer className="step-card-footer">
            <div className="step-footer-meta">
              <span>Step ID: <code>{currentStep.id}</code></span>
              <span>·</span>
              <span>Hash: <code>{run.contentHash.slice(0, 10)}…</code></span>
              <span>·</span>
              <span>Revision: {run.revision}</span>
            </div>
          </footer>
        </section>

        {/* Sidebar: Dossier & Event Audit Log */}
        <aside className="runner-sidebar">
          {/* Dossier Card */}
          <div className="sidebar-card">
            <h3>Dossier & Collected State</h3>
            {Object.keys(run.collectedValues).length === 0 ? (
              <p className="meta">Values entered during collect steps will populate here.</p>
            ) : (
              <dl className="dossier-list">
                {Object.entries(run.collectedValues).map(([k, v]) => (
                  <div key={k} className="dossier-item">
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>

          {/* Audit Trail */}
          <div className="sidebar-card">
            <h3>Durable Event Trail ({events.length})</h3>
            <ol className="audit-timeline">
              {events.map((evt) => (
                <li key={evt.id} className="audit-event-item">
                  <div className="audit-event-top">
                    <span className="audit-event-type">{evt.eventType}</span>
                    <span className="audit-event-time">{formatTime(evt.createdAt)}</span>
                  </div>
                  <div className="audit-event-step">
                    {evt.fromStepId ? (
                      <span>{evt.fromStepId} → <strong>{evt.toStepId}</strong></span>
                    ) : (
                      <span>Entry: <strong>{evt.toStepId}</strong></span>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return iso;
  }
}
