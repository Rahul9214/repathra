"use client";

import { useState } from "react";
import Link from "next/link";
import { SignInButton } from "@clerk/nextjs";

import {
  IconArrowRight,
  IconClose,
  IconPlus,
  IconRoute,
  IconSearch,
} from "@/components/studio/icons";
import type { RunListItem, RunStatus } from "@/features/resume-anywhere/model";

export function RunListView({
  runs,
  userState,
}: {
  runs: RunListItem[];
  userState: "authenticated" | "unauthenticated" | "auth_not_configured";
}) {
  const [filter, setFilter] = useState<"all" | RunStatus>("all");
  const [search, setSearch] = useState("");

  if (userState === "unauthenticated") {
    return (
      <div className="directory-workspace">
        <header className="directory-header">
          <div className="directory-header-content">
            <div className="directory-title-row">
              <h1>Resume Anywhere</h1>
              <span className="directory-count-pill">Sign In Required</span>
            </div>
            <p className="directory-subtitle">
              Continue an interrupted workflow from the exact persisted step across any browser, device, or session.
            </p>
          </div>
        </header>

        <section className="state-panel" role="status">
          <h2>Authentication Required</h2>
          <p>
            REPATHRA saves every workflow step securely to the database under your user account. Sign in to view and resume your active journeys.
          </p>
          <div style={{ marginTop: "1rem" }}>
            <SignInButton mode="modal">
              <button type="button" className="button button-primary">
                <span>Sign In to Continue</span>
                <IconArrowRight />
              </button>
            </SignInButton>
          </div>
        </section>
      </div>
    );
  }

  if (userState === "auth_not_configured") {
    return (
      <div className="directory-workspace">
        <header className="directory-header">
          <div className="directory-header-content">
            <div className="directory-title-row">
              <h1>Resume Anywhere</h1>
              <span className="badge badge-status-frozen">Auth Offline</span>
            </div>
            <p className="directory-subtitle">
              User authentication is not configured in this environment. Private runs cannot be accessed.
            </p>
          </div>
        </header>
        <section className="state-panel is-error" role="alert">
          <h2>Authentication Offline</h2>
          <p>Please configure Clerk environment keys to enable secure cross-device workflow continuation.</p>
        </section>
      </div>
    );
  }

  const activeCount = runs.filter((r) => r.status === "active").length;
  const pausedCount = runs.filter((r) => r.status === "paused").length;
  const completedCount = runs.filter((r) => r.status === "completed").length;

  const filtered = runs.filter((run) => {
    const matchesFilter = filter === "all" ? true : run.status === filter;
    const matchesSearch =
      run.journeyTitle.toLowerCase().includes(search.toLowerCase()) ||
      run.currentStepTitle.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="directory-workspace">
      {/* Editorial Header */}
      <header className="directory-header">
        <div className="directory-header-content">
          <div className="directory-title-row">
            <h1>My Journeys</h1>
            <span className="directory-count-pill">
              {runs.length} {runs.length === 1 ? "journey" : "journeys"}
            </span>
          </div>
          <p className="directory-subtitle">
            Resume any workflow from anywhere. Every step, input, and decision is frozen in cloud PostgreSQL.
          </p>
        </div>

        <div className="directory-header-actions">
          <Link href="/" className="button button-primary button-sm">
            <IconPlus />
            <span>Browse Workflows</span>
          </Link>
        </div>
      </header>

      {/* Metric Cards Banner */}
      <div className="run-metrics-grid">
        <div className="metric-card">
          <span className="metric-label">In Progress</span>
          <span className="metric-value">{activeCount}</span>
          <span className="metric-sub">Active user steps</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Paused</span>
          <span className="metric-value">{pausedCount}</span>
          <span className="metric-sub">Awaiting signals or handoffs</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Completed</span>
          <span className="metric-value">{completedCount}</span>
          <span className="metric-sub">Sealed outcomes</span>
        </div>
      </div>

      {/* Toolbar: Search and Filter Tabs */}
      <div className="directory-toolbar">
        <div className="search-box">
          <IconSearch className="search-icon" />
          <input
            type="search"
            placeholder="Search runs by workflow or current step…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search my journeys"
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

        <div className="filter-group" role="tablist" aria-label="Run status filter">
          <button
            type="button"
            className={filter === "all" ? "filter-tab is-active" : "filter-tab"}
            onClick={() => setFilter("all")}
            role="tab"
            aria-selected={filter === "all"}
          >
            All ({runs.length})
          </button>
          <button
            type="button"
            className={filter === "active" ? "filter-tab is-active" : "filter-tab"}
            onClick={() => setFilter("active")}
            role="tab"
            aria-selected={filter === "active"}
          >
            Active ({activeCount})
          </button>
          <button
            type="button"
            className={filter === "paused" ? "filter-tab is-active" : "filter-tab"}
            onClick={() => setFilter("paused")}
            role="tab"
            aria-selected={filter === "paused"}
          >
            Paused ({pausedCount})
          </button>
          <button
            type="button"
            className={filter === "completed" ? "filter-tab is-active" : "filter-tab"}
            onClick={() => setFilter("completed")}
            role="tab"
            aria-selected={filter === "completed"}
          >
            Completed ({completedCount})
          </button>
        </div>
      </div>

      {/* Runs List */}
      {filtered.length === 0 ? (
        <div className="directory-empty">
          <p className="empty-title">
            {search
              ? "No journey runs match your search"
              : filter !== "all"
                ? `No ${filter} journey runs`
                : "No journey runs started yet"}
          </p>
          <p className="empty-sub">
            {search
              ? "Try adjusting your search terms or clearing the filter."
              : "Select a published workflow from the Journey Directory to start your first run."}
          </p>
          <Link href="/" className="button button-primary button-sm" style={{ marginTop: "1rem" }}>
            <span>Explore Published Workflows</span>
            <IconArrowRight />
          </Link>
        </div>
      ) : (
        <div className="runs-grid" role="region" aria-label="My journey runs">
          {filtered.map((run) => {
            const isCompleted = run.status === "completed";
            const isPaused = run.status === "paused";
            const percent =
              run.totalStepCount > 0
                ? Math.min(100, Math.round((run.completedStepCount / run.totalStepCount) * 100))
                : 0;

            return (
              <article key={run.id} className="run-card">
                <div className="run-card-header">
                  <div className="run-card-title-group">
                    <span className="badge badge-status-published">
                      Version {run.versionNumber}
                    </span>
                    {run.journeyOrigin === "sandbox" ? (
                      <span className="badge badge-sandbox">Sandbox</span>
                    ) : null}
                    <span className={`run-status-pill is-${run.status}`}>
                      <span className="status-dot" />
                      <span>{run.status === "active" ? "Active" : run.status === "paused" ? "Paused" : "Completed"}</span>
                    </span>
                  </div>

                  <h2 className="run-card-title">
                    <Link href={`/runs/${run.id}`}>{run.journeyTitle}</Link>
                  </h2>
                </div>

                {run.sandboxNotice ? (
                  <p className="run-sandbox-notice">
                    {run.sandboxNotice}
                  </p>
                ) : null}

                {/* Progress bar */}
                <div className="run-progress-wrap">
                  <div className="run-progress-labels">
                    <span className="progress-step-text">
                      {isCompleted ? (
                        <>Completed · Outcome: <strong>{run.completedOutcome}</strong></>
                      ) : (
                        <>Current Step: <strong>{run.currentStepTitle}</strong></>
                      )}
                    </span>
                    <span className="progress-percent">
                      {run.completedStepCount} of {run.totalStepCount} steps ({percent}%)
                    </span>
                  </div>
                  <div className="progress-bar-track">
                    <div
                      className={`progress-bar-fill is-${run.status}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>

                <div className="run-card-footer">
                  <div className="run-meta-info">
                    <span className="meta-revision">Revision {run.revision}</span>
                    <span className="meta-dot">·</span>
                    <span className="meta-timestamp">
                      Saved {formatRelative(run.updatedAt)}
                    </span>
                  </div>

                  <Link href={`/runs/${run.id}`} className="button button-primary button-sm">
                    <span>{isCompleted ? "View Audit Log" : isPaused ? "Inspect Paused Step" : "Continue Journey"}</span>
                    <IconArrowRight />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* System Note */}
      <footer className="directory-runtime-note" aria-label="Resume Anywhere Guarantees">
        <div className="runtime-note-icon">
          <IconRoute />
        </div>
        <div className="runtime-note-text">
          <h3>Resume Anywhere: Server-Side State Machine & Deterministic Invariance</h3>
          <p>
            Journey progress is stored durably in PostgreSQL using revision-locked optimistic updates. Even if you switch devices or if newer journey versions are published, this run remains bound to its exact frozen version snapshot.
          </p>
        </div>
      </footer>
    </div>
  );
}

function formatRelative(iso: string): string {
  try {
    const diffMs = Date.now() - new Date(iso).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return "just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}
