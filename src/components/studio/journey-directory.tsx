"use client";

import { useActionState, useId, useState } from "react";
import Link from "next/link";

import { createJourneyAction } from "@/app/studio/actions";
import { ActionNote } from "@/components/studio/create-journey-form";
import {
  IconActivity,
  IconArrowRight,
  IconClose,
  IconInfo,
  IconLayers,
  IconPlus,
  IconRoute,
  IconSearch,
  IconSparkles,
} from "@/components/studio/icons";
import { OperatorSignInButton } from "@/components/studio/clerk-operator";
import type { StoredJourneyListItem } from "@/platform/journeys/repository";
import type { OperatorGateState } from "@/platform/journeys/live";

export function JourneyDirectory({
  journeys,
  gate,
}: {
  journeys: StoredJourneyListItem[];
  gate: OperatorGateState;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "published" | "draft">("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeInfoSlug, setActiveInfoSlug] = useState<string | null>(null);

  const filtered = journeys.filter((journey) => {
    const matchesSearch =
      journey.title.toLowerCase().includes(search.toLowerCase()) ||
      journey.summary.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (filter === "published") return journey.latestVersion !== null;
    if (filter === "draft") return journey.latestVersion === null;
    return true;
  });

  const publishedCount = journeys.filter((j) => j.latestVersion !== null).length;
  const draftCount = journeys.filter((j) => j.latestVersion === null).length;
  const isOperator = gate === "allowed";
  const spotlightJourney = journeys[0];

  return (
    <div className="directory-workspace">
      {/* 05: Editorial Header with Restrained UI Chrome */}
      <header className="directory-header">
        <div className="directory-header-content">
          <div className="directory-title-row">
            <h1>Journey Directory</h1>
            <span className="directory-count-pill">
              {journeys.length} {journeys.length === 1 ? "workflow" : "workflows"}
            </span>
          </div>
          <p className="directory-subtitle">
            Design, review, and publish interactive deterministic journeys with immutable version history.
          </p>
        </div>

        <div className="directory-header-actions">
          {isOperator ? (
            <button
              type="button"
              className="button button-primary"
              onClick={() => setIsCreateOpen(true)}
            >
              <IconPlus />
              <span>New Journey</span>
            </button>
          ) : gate === "unauthenticated" ? (
            <OperatorSignInButton label="Sign In as Operator" className="button button-primary" />
          ) : (
            <span className="badge badge-sandbox">Read-Only Mode</span>
          )}
        </div>
      </header>

      {/* 06: Rhythmic Section Hierarchy — Spotlight Feature Banner */}
      {spotlightJourney && !search && filter === "all" ? (
        <section className="spotlight-banner" aria-label="Featured Workflow">
          <div className="spotlight-content">
            <div className="spotlight-badge-row">
              <span className="badge badge-operator">
                <IconSparkles /> Featured Workflow
              </span>
              {spotlightJourney.origin === "sandbox" ? (
                <span className="badge badge-sandbox">Sandbox Environment</span>
              ) : (
                <span className="badge-custom">Custom Workflow</span>
              )}
              {spotlightJourney.latestVersion !== null ? (
                <span className="badge-status-published">
                  Version {spotlightJourney.latestVersion}
                </span>
              ) : (
                <span className="badge-status-draft">Draft</span>
              )}
            </div>

            <h2 className="spotlight-title">
              <Link href={`/journeys/${spotlightJourney.slug}`}>
                {spotlightJourney.title}
              </Link>
            </h2>
            <p className="spotlight-summary">{spotlightJourney.summary}</p>

            {/* 07 & 08: Micro-Pipeline Visualizer */}
            <div className="spotlight-pipeline" aria-label="Workflow path preview">
              <div className="pipeline-step is-start">
                <span className="step-dot" />
                <span className="step-label">Collect</span>
              </div>
              <span className="pipeline-connector">→</span>
              <div className="pipeline-step">
                <span className="step-dot" />
                <span className="step-label">Review</span>
              </div>
              <span className="pipeline-connector">→</span>
              <div className="pipeline-step is-decision">
                <span className="step-dot" />
                <span className="step-label">Decision Forks</span>
              </div>
              <span className="pipeline-connector">→</span>
              <div className="pipeline-step is-end">
                <span className="step-dot" />
                <span className="step-label">Outcome</span>
              </div>
            </div>

            <div className="spotlight-footer">
              <div className="spotlight-stats">
                <span className="stat-item">
                  <IconActivity /> Deterministic Runtime
                </span>
                <span className="stat-item">
                  <IconLayers /> Immutable Audit Log
                </span>
              </div>

              <Link
                href={`/journeys/${spotlightJourney.slug}`}
                className="button button-primary"
              >
                <span>{isOperator ? "Open in Journey Studio" : "View Workflow Map"}</span>
                <IconArrowRight />
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      {/* 03 & 04: Search & Filter Toolbar */}
      <div className="directory-toolbar">
        <div className="search-box">
          <IconSearch className="search-icon" />
          <input
            type="search"
            placeholder="Search journeys by name, domain, or purpose…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search journeys"
          />
          {search ? (
            <button
              type="button"
              className="search-clear"
              onClick={() => setSearch("")}
              aria-label="Clear search"
            >
              <IconClose />
            </button>
          ) : null}
        </div>

        <div className="filter-group" role="tablist" aria-label="Journey status filter">
          <button
            type="button"
            className={filter === "all" ? "filter-tab is-active" : "filter-tab"}
            onClick={() => setFilter("all")}
            role="tab"
            aria-selected={filter === "all"}
          >
            All ({journeys.length})
          </button>
          <button
            type="button"
            className={filter === "published" ? "filter-tab is-active" : "filter-tab"}
            onClick={() => setFilter("published")}
            role="tab"
            aria-selected={filter === "published"}
          >
            Published ({publishedCount})
          </button>
          <button
            type="button"
            className={filter === "draft" ? "filter-tab is-active" : "filter-tab"}
            onClick={() => setFilter("draft")}
            role="tab"
            aria-selected={filter === "draft"}
          >
            Drafts ({draftCount})
          </button>
        </div>
      </div>

      {/* Compact Journey List */}
      {filtered.length === 0 ? (
        <div className="directory-empty">
          <p className="empty-title">
            {search ? "No journeys match your search" : "No journeys available"}
          </p>
          <p className="empty-sub">
            {search
              ? "Try adjusting your search terms or clearing the filter."
              : isOperator
                ? "Get started by creating your first workflow journey."
                : "Sign in with an authorized operator account to create new journeys."}
          </p>
          {search ? (
            <button
              type="button"
              className="button button-quiet button-sm"
              onClick={() => setSearch("")}
            >
              Clear Search
            </button>
          ) : isOperator ? (
            <button
              type="button"
              className="button button-primary button-sm"
              onClick={() => setIsCreateOpen(true)}
            >
              <IconPlus />
              <span>Create Journey</span>
            </button>
          ) : null}
        </div>
      ) : (
        <div className="directory-table" role="region" aria-label="Journeys list">
          {filtered.map((journey) => {
            const isSandbox = journey.origin === "sandbox";
            const isInfoOpen = activeInfoSlug === journey.slug;

            return (
              <article key={journey.slug} className="directory-row">
                <div className="directory-row-main">
                  <div className="directory-row-title-bar">
                    <h2 className="directory-row-title">
                      <Link href={`/journeys/${journey.slug}`}>
                        {journey.title}
                      </Link>
                    </h2>

                    {isSandbox ? (
                      <div className="sandbox-indicator-wrap">
                        <button
                          type="button"
                          className="sandbox-chip"
                          onClick={() => setActiveInfoSlug(isInfoOpen ? null : journey.slug)}
                          aria-label="Sandbox information"
                          title="Click to view sandbox details"
                        >
                          <span>Sandbox</span>
                          <IconInfo />
                        </button>

                        {isInfoOpen ? (
                          <div className="sandbox-popover" role="tooltip">
                            <p>
                              Sample workflow provided for demonstration. No external registry, customer, or payment record is created.
                            </p>
                            <button
                              type="button"
                              className="popover-close"
                              onClick={() => setActiveInfoSlug(null)}
                            >
                              Dismiss
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <span className="badge-custom">Custom</span>
                    )}

                    <span className="status-indicator">
                      {journey.latestVersion !== null ? (
                        <span className="badge-status-published">
                          Version {journey.latestVersion}
                        </span>
                      ) : (
                        <span className="badge-status-draft">Draft</span>
                      )}
                    </span>
                  </div>

                  <p className="directory-row-summary">{journey.summary}</p>
                </div>

                <div className="directory-row-action">
                  <Link
                    href={`/journeys/${journey.slug}`}
                    className={isOperator ? "button button-primary button-sm" : "button button-secondary button-sm"}
                  >
                    <span>{isOperator ? "Edit Journey" : "View Journey"}</span>
                    <IconArrowRight />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* 06: Architectural Sandbox Runtime Note */}
      <footer className="directory-runtime-note" aria-label="System Runtime Architecture">
        <div className="runtime-note-icon">
          <IconRoute />
        </div>
        <div className="runtime-note-text">
          <h3>Deterministic State Machine & Clerk Operator Security</h3>
          <p>
            REPATHRA executes journey workflows as verifiable state trees. Unpublished drafts remain private to authorized operators, while published versions receive immutable cryptographic version tags.
          </p>
        </div>
      </footer>

      {/* New Journey Creation Modal */}
      {isCreateOpen ? (
        <CreateJourneyModal onClose={() => setIsCreateOpen(false)} />
      ) : null}
    </div>
  );
}

function CreateJourneyModal({ onClose }: { onClose: () => void }) {
  const [state, action, pending] = useActionState(createJourneyAction, null);
  const [slug, setSlug] = useState("");
  const [slugModified, setSlugModified] = useState(false);
  const titleId = useId();
  const slugId = useId();
  const summaryId = useId();

  function handleTitleChange(value: string) {
    if (!slugModified) {
      const generated = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 64);
      setSlug(generated);
    }
  }

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-create-title"
    >
      <div className="modal-dialog">
        <div className="modal-header">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="badge badge-operator">New Journey</span>
            <button
              type="button"
              className="button-icon-close"
              onClick={onClose}
              aria-label="Close dialog"
            >
              <IconClose />
            </button>
          </div>
          <h2 id="modal-create-title">Create Journey</h2>
          <p>Initialize a new workflow ready for interactive step design.</p>
        </div>

        <form action={action} className="modal-form">
          <label htmlFor={titleId}>
            Journey Name
            <input
              id={titleId}
              name="title"
              required
              maxLength={140}
              placeholder="e.g. Identity Verification"
              autoFocus
              onChange={(e) => handleTitleChange(e.target.value)}
            />
          </label>

          <label htmlFor={slugId}>
            Web Address (Slug)
            <input
              id={slugId}
              name="slug"
              required
              minLength={3}
              maxLength={64}
              value={slug}
              placeholder="identity-verification"
              onChange={(e) => {
                setSlugModified(true);
                setSlug(e.target.value);
              }}
            />
          </label>

          <label htmlFor={summaryId}>
            Purpose
            <textarea
              id={summaryId}
              name="summary"
              required
              maxLength={400}
              rows={3}
              placeholder="Brief description of this workflow's objectives and handoffs…"
            />
          </label>

          <ActionNote state={state} />

          <div className="modal-actions">
            <button
              type="button"
              className="button button-quiet"
              onClick={onClose}
              disabled={pending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="button button-primary"
              disabled={pending}
            >
              {pending ? "Creating…" : "Create Journey"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
