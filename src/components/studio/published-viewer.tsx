"use client";

import { useState } from "react";
import Link from "next/link";

import {
  IconArrowRight,
  IconChevronDown,
} from "@/components/studio/icons";
import { JourneyMap } from "@/components/studio/journey-map";
import { StepSettings } from "@/components/studio/step-settings";
import { OperatorSignInButton } from "@/components/studio/clerk-operator";
import { StartJourneyButton } from "@/components/runs/start-journey-button";
import type { JourneyDocument } from "@/features/journey-studio/model";
import type { StoredVersionSummary } from "@/platform/journeys/repository";

export function PublishedViewer({
  slug,
  title,
  summary,
  versionNumber,
  publishedAt,
  publishedBy,
  document,
  versions = [],
  isCurrent = true,
  canEdit = false,
  origin = "operator",
  sandboxNotice,
}: {
  slug: string;
  title: string;
  summary: string;
  versionNumber: number;
  publishedAt: string;
  publishedBy?: string;
  document: JourneyDocument;
  versions?: StoredVersionSummary[];
  isCurrent?: boolean;
  canEdit?: boolean;
  origin?: "operator" | "sandbox";
  sandboxNotice?: string | null;
}) {
  const [selectedStepId, setSelectedStepId] = useState<string>(
    document.steps[0]?.id ?? "step-1",
  );
  const [showVersionMenu, setShowVersionMenu] = useState(false);
  const [mobileTab, setMobileTab] = useState<"map" | "settings">("map");

  const selectedIndex = document.steps.findIndex((s) => s.id === selectedStepId);
  const validIndex = selectedIndex >= 0 ? selectedIndex : 0;
  const selectedStep = document.steps[validIndex] ?? document.steps[0];

  return (
    <div className="studio-workspace">
      {/* Top Header */}
      <header className="workspace-header">
        <div className="workspace-header-left">
          <nav className="breadcrumbs" aria-label="Breadcrumb">
            <Link href="/">Journeys</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{title}</span>
          </nav>

          <div className="workspace-title-row">
            <h1>{title}</h1>
            <span className="badge badge-status-published">
              Version {versionNumber} · Published
            </span>
            {origin === "sandbox" ? (
              <span className="badge badge-sandbox">Sandbox</span>
            ) : null}
          </div>

          <p className="workspace-summary">{summary}</p>
          <div className="workspace-publish-stamp">
            Published {formatDate(publishedAt)} {publishedBy ? `by ${publishedBy}` : ""}
          </div>
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
              <span className="version-dot is-published" />
              <span>Version {versionNumber}</span>
              <IconChevronDown />
            </button>

            {showVersionMenu ? (
              <div className="version-dropdown-menu" role="menu">
                <div className="version-dropdown-header">
                  <span>Version Timeline</span>
                </div>
                {canEdit ? (
                  <Link
                    href={`/journeys/${slug}`}
                    className="version-dropdown-item"
                    role="menuitem"
                  >
                    <div>
                      <span className="item-label">Draft in Progress</span>
                      <span className="badge badge-status-draft">Working Copy</span>
                    </div>
                  </Link>
                ) : null}
                {versions.map((ver) => {
                  const isThis = ver.versionNumber === versionNumber;
                  return (
                    <Link
                      key={ver.versionNumber}
                      href={`/journeys/${slug}/versions/${ver.versionNumber}`}
                      className={`version-dropdown-item ${isThis ? "is-active" : ""}`}
                      role="menuitem"
                    >
                      <div>
                        <span className="item-label">Version {ver.versionNumber}</span>
                        <span className="item-date">{formatDate(ver.publishedAt)}</span>
                      </div>
                      {isThis ? (
                        <span className="badge badge-status-published">Viewing</span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>

          {/* Start Journey Button */}
          <StartJourneyButton slug={slug} versionNumber={versionNumber} />

          {/* Action Button: Edit or Sign In */}
          {canEdit ? (
            <Link href={`/journeys/${slug}`} className="button button-secondary button-sm">
              <span>Open Draft Editor</span>
              <IconArrowRight />
            </Link>
          ) : (
            <OperatorSignInButton label="Sign In to Edit" className="button button-quiet button-sm" />
          )}
        </div>
      </header>

      {/* Historical / Readonly Snapshot Banner */}
      {!isCurrent ? (
        <div className="snapshot-notice-banner">
          <div>
            <strong>Historical Snapshot:</strong> You are viewing published Version {versionNumber}.
          </div>
          <Link href={`/journeys/${slug}`} className="button button-secondary button-sm">
            View Current Active Journey →
          </Link>
        </div>
      ) : null}

      {/* Sandbox Notice Banner if applicable */}
      {sandboxNotice ? (
        <div className="sandbox-banner" style={{ marginBottom: "1.25rem" }}>
          {sandboxNotice}
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
          Step Details ({validIndex + 1}/{document.steps.length})
        </button>
      </div>

      {/* Two-Column Layout: Visual Map (Left) + Step Settings Read-Only (Right) */}
      <div className="studio-canvas-layout">
        <div className={`canvas-left ${mobileTab === "settings" ? "is-hidden-mobile" : ""}`}>
          <JourneyMap
            document={document}
            selectedStepId={selectedStep?.id ?? null}
            onSelectStep={(id) => {
              setSelectedStepId(id);
              setMobileTab("settings");
            }}
            readOnly={true}
          />
        </div>

        <div className={`canvas-right ${mobileTab === "map" ? "is-hidden-mobile" : ""}`}>
          {selectedStep ? (
            <StepSettings
              step={selectedStep}
              stepIndex={validIndex}
              totalSteps={document.steps.length}
              document={document}
              onChange={() => {}}
              onMove={() => {}}
              onRemove={() => {}}
              readOnly={true}
            />
          ) : null}
        </div>
      </div>
    </div>
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
