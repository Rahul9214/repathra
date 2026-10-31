"use client";

import { useActionState, useState } from "react";
import Link from "next/link";

import { publishDraftAction, saveDraftAction } from "@/app/studio/actions";
import { ActionNote } from "@/components/studio/create-journey-form";
import { DraftAccessBanner } from "@/components/studio/clerk-operator";
import {
  IconCheck,
  IconChevronDown,
  IconClose,
} from "@/components/studio/icons";
import { JourneyMap } from "@/components/studio/journey-map";
import { StepSettings } from "@/components/studio/step-settings";
import type { JourneyDocument, JourneyStep } from "@/features/journey-studio/model";
import { validateJourney } from "@/features/journey-studio/validate";
import type { StoredVersionSummary } from "@/platform/journeys/repository";

export function DraftEditor({
  slug,
  revision: initialRevision,
  document: initialDocument,
  locked,
  lockMessage,
  draftAccess,
  versions = [],
}: {
  slug: string;
  revision: number;
  document: JourneyDocument;
  locked: boolean;
  lockMessage: string | null;
  draftAccess?: "auth_not_configured" | "unauthenticated" | "unauthorized" | "allowed";
  versions?: StoredVersionSummary[];
}) {
  const [saveState, saveAction, savePending] = useActionState(saveDraftAction, null);
  const [publishState, publishAction, publishPending] = useActionState(publishDraftAction, null);

  const [document, setDocument] = useState<JourneyDocument>(initialDocument);
  const [selectedStepId, setSelectedStepId] = useState<string>(
    initialDocument.steps[0]?.id ?? "step-1",
  );
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showVersionMenu, setShowVersionMenu] = useState(false);
  const [showAuditDetails, setShowAuditDetails] = useState(false);
  const [mobileTab, setMobileTab] = useState<"map" | "settings">("map");

  const pending = savePending || publishPending;
  const revision = Math.max(initialRevision, saveState?.revision ?? 0, publishState?.revision ?? 0);
  const local = validateJourney(document);
  const serverIssues = !saveState?.ok ? saveState?.issues : !publishState?.ok ? publishState?.issues : undefined;
  const issues = !local.ok ? local.issues : (serverIssues ?? []);
  const payload = JSON.stringify({ slug, expectedRevision: revision, document });

  const selectedIndex = document.steps.findIndex((s) => s.id === selectedStepId);
  const validIndex = selectedIndex >= 0 ? selectedIndex : 0;
  const selectedStep = document.steps[validIndex] ?? document.steps[0];

  const isPublishModalOpen = showPublishModal && !publishState?.ok;
  const latestPublishedVersion = versions.at(-1)?.versionNumber ?? null;
  const nextPublishVersion = (latestPublishedVersion ?? 0) + 1;

  function updateDocument(next: JourneyDocument) {
    const entryStepId = next.steps[0]?.id ?? next.entryStepId;
    setDocument({ ...next, entryStepId });
  }

  function handleStepChange(updatedStep: JourneyStep) {
    const steps = document.steps.map((current, idx) => (idx === validIndex ? updatedStep : current));
    updateDocument({ ...document, steps });
  }

  function handleMoveStep(direction: -1 | 1) {
    const steps = [...document.steps];
    const target = validIndex + direction;
    const current = steps[validIndex];
    const swap = steps[target];
    if (!current || !swap) return;
    steps[validIndex] = swap;
    steps[target] = current;
    updateDocument({ ...document, steps });
  }

  function handleRemoveStep() {
    if (document.steps.length <= 1) return;
    const nextSteps = document.steps.filter((_, idx) => idx !== validIndex);
    updateDocument({ ...document, steps: nextSteps });
    setSelectedStepId(nextSteps[0]?.id ?? "");
  }

  function handleAddStep() {
    const id = `step-${document.steps.length + 1}`;
    const fallbackNext = document.steps[0]?.id ?? id;
    const newStep: JourneyStep = {
      id,
      type: "review",
      title: `Step ${document.steps.length + 1}`,
      instruction: "Review and verify the workflow progress at this checkpoint.",
      next: fallbackNext,
    };
    updateDocument({ ...document, steps: [...document.steps, newStep] });
    setSelectedStepId(id);
    setMobileTab("settings");
  }

  return (
    <form action={saveAction} className="studio-workspace" aria-busy={pending}>
      <input type="hidden" name="payload" value={payload} />

      {/* Top Studio Control Bar */}
      <header className="workspace-header">
        <div className="workspace-header-left">
          <nav className="breadcrumbs" aria-label="Breadcrumb">
            <Link href="/">Journeys</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{document.title}</span>
          </nav>

          <div className="workspace-title-row">
            <h1>{document.title}</h1>
            <button
              type="button"
              className="button-pill-quiet"
              onClick={() => setShowSettingsModal(true)}
              title="Edit journey title and purpose"
            >
              Edit Details
            </button>
          </div>

          <p className="workspace-summary">{document.summary}</p>
        </div>

        <div className="workspace-header-actions">
          {/* Version Switcher Dropdown */}
          <div className="version-switcher">
            <button
              type="button"
              className="button button-secondary button-sm"
              onClick={() => setShowVersionMenu(!showVersionMenu)}
              aria-haspopup="true"
              aria-expanded={showVersionMenu}
            >
              <span className="version-dot is-draft" />
              <span>Draft (Rev {revision})</span>
              <IconChevronDown />
            </button>

            {showVersionMenu ? (
              <div className="version-dropdown-menu" role="menu">
                <div className="version-dropdown-header">
                  <span>Version Timeline</span>
                </div>
                <div className="version-dropdown-item is-active" role="menuitem">
                  <span className="item-label">Draft in Progress</span>
                  <span className="badge badge-status-draft">Working Copy</span>
                </div>
                {versions.length === 0 ? (
                  <div className="version-dropdown-empty">
                    No published versions yet
                  </div>
                ) : (
                  versions.map((ver) => (
                    <Link
                      key={ver.versionNumber}
                      href={`/journeys/${slug}/versions/${ver.versionNumber}`}
                      className="version-dropdown-item"
                      role="menuitem"
                    >
                      <div>
                        <span className="item-label">Version {ver.versionNumber}</span>
                        <span className="item-date">{formatDate(ver.publishedAt)}</span>
                      </div>
                      <span className="badge badge-status-published">Published</span>
                    </Link>
                  ))
                )}
              </div>
            ) : null}
          </div>

          {/* Operator Action Buttons */}
          <div className="workspace-btn-group">
            <button
              type="submit"
              className="button button-secondary button-sm"
              disabled={locked || pending}
            >
              {savePending ? (
                <span>Saving…</span>
              ) : saveState?.ok ? (
                <>
                  <IconCheck />
                  <span>Saved</span>
                </>
              ) : (
                <span>Save Draft</span>
              )}
            </button>

            <button
              type="button"
              className="button button-primary button-sm"
              disabled={locked || pending || issues.length > 0}
              onClick={() => setShowPublishModal(true)}
            >
              <span>Publish Version</span>
            </button>
          </div>
        </div>
      </header>

      {/* Draft Access Banners / Lock Warnings */}
      {locked ? (
        draftAccess && draftAccess !== "allowed" ? (
          <DraftAccessBanner draftAccess={draftAccess} />
        ) : (
          <p className="note is-error" role="status">
            {lockMessage}
          </p>
        )
      ) : null}

      {/* Validation Issue Alerts */}
      {issues.length > 0 ? (
        <div className="issue-list" role="alert">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong>Workflow Guidance ({issues.length} {issues.length === 1 ? "item" : "items"} to resolve)</strong>
          </div>
          <ul>
            {issues.map((issue) => (
              <li key={`${issue.code}-${issue.path}-${issue.message}`}>
                {issue.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Mobile Tab Switcher */}
      <div className="mobile-view-tabs" role="tablist" aria-label="Mobile workspace view">
        <button
          type="button"
          className={mobileTab === "map" ? "mobile-tab is-active" : "mobile-tab"}
          onClick={() => setMobileTab("map")}
          role="tab"
          aria-selected={mobileTab === "map"}
        >
          Journey Map ({document.steps.length})
        </button>
        <button
          type="button"
          className={mobileTab === "settings" ? "mobile-tab is-active" : "mobile-tab"}
          onClick={() => setMobileTab("settings")}
          role="tab"
          aria-selected={mobileTab === "settings"}
        >
          Step Settings ({validIndex + 1}/{document.steps.length})
        </button>
      </div>

      {/* Two-Column Studio Layout: Visual Map (Left) + Step Settings (Right) */}
      <div className="studio-canvas-layout">
        <div className={`canvas-left ${mobileTab === "settings" ? "is-hidden-mobile" : ""}`}>
          <JourneyMap
            document={document}
            selectedStepId={selectedStep?.id ?? null}
            onSelectStep={(id) => {
              setSelectedStepId(id);
              setMobileTab("settings");
            }}
            onAddStep={handleAddStep}
            readOnly={locked}
          />
        </div>

        <div className={`canvas-right ${mobileTab === "map" ? "is-hidden-mobile" : ""}`}>
          {selectedStep ? (
            <StepSettings
              step={selectedStep}
              stepIndex={validIndex}
              totalSteps={document.steps.length}
              document={document}
              onChange={handleStepChange}
              onMove={handleMoveStep}
              onRemove={handleRemoveStep}
              readOnly={locked}
            />
          ) : (
            <div className="settings-empty">
              <p>Select a step from the journey map to customize its settings.</p>
            </div>
          )}
        </div>
      </div>

      {/* Action Feedback Note */}
      <ActionNote state={saveState} />
      <ActionNote state={publishState} />

      {/* Technical Details Accordion (Operators Only) */}
      <div className="technical-audit-drawer">
        <button
          type="button"
          className="technical-details-toggle"
          onClick={() => setShowAuditDetails(!showAuditDetails)}
          aria-expanded={showAuditDetails}
        >
          <span>{showAuditDetails ? "▾ Hide Technical Operator Audit" : "▸ Show Technical Operator Audit"}</span>
        </button>

        {showAuditDetails ? (
          <div className="technical-details-card">
            <div className="technical-row">
              <span>Workflow Slug:</span>
              <code>{slug}</code>
            </div>
            <div className="technical-row">
              <span>Database Revision:</span>
              <code>{revision}</code>
            </div>
            <div className="technical-row">
              <span>Total Validated Steps:</span>
              <code>{document.steps.length}</code>
            </div>
            <div className="technical-row">
              <span>Integrity Status:</span>
              <code>{issues.length === 0 ? "Compliant" : `${issues.length} Issues`}</code>
            </div>
          </div>
        ) : null}
      </div>

      {/* Edit Journey Title & Summary Modal */}
      {showSettingsModal ? (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="settings-modal-title">
          <div className="modal-dialog">
            <div className="modal-header">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="badge badge-operator">Journey Info</span>
                <button
                  type="button"
                  className="button-icon-close"
                  onClick={() => setShowSettingsModal(false)}
                  aria-label="Close dialog"
                >
                  <IconClose />
                </button>
              </div>
              <h2 id="settings-modal-title">Edit Journey Details</h2>
              <p>Update the human-readable title and operational summary.</p>
            </div>

            <div className="modal-form">
              <label>
                Journey Name
                <input
                  value={document.title}
                  maxLength={140}
                  onChange={(e) => updateDocument({ ...document, title: e.target.value })}
                />
              </label>

              <label>
                Purpose / Summary
                <textarea
                  value={document.summary}
                  maxLength={400}
                  rows={3}
                  onChange={(e) => updateDocument({ ...document, summary: e.target.value })}
                />
              </label>

              <div className="modal-actions">
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => setShowSettingsModal(false)}
                >
                  Apply Details
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Focused Publishing Confirmation Modal */}
      {isPublishModalOpen ? (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="publish-modal-title">
          <div className="modal-dialog">
            <div className="modal-header">
              <span className="badge badge-status-published">Ready to Publish</span>
              <h2 id="publish-modal-title">Publish Version {nextPublishVersion}</h2>
              <p>
                Freeze the current draft into an immutable published version.
              </p>
            </div>

            <div className="modal-body">
              <p>
                <strong>Database Immutability:</strong> Once published, this version will be assigned permanent <strong>Version {nextPublishVersion}</strong>. Neon PostgreSQL triggers strictly reject any updates or deletion of published records.
              </p>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
                <span className="badge badge-status-published">{document.steps.length} Steps Verified</span>
                <span className="badge badge-status-draft">Revision {revision} Snapshot</span>
              </div>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="button button-quiet"
                onClick={() => setShowPublishModal(false)}
                disabled={publishPending}
              >
                Cancel
              </button>
              <button
                type="submit"
                formAction={publishAction}
                className="button button-primary"
                disabled={publishPending}
              >
                {publishPending ? "Publishing…" : `Confirm & Publish v${nextPublishVersion}`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}
