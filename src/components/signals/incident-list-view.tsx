"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import type {
  IncidentListItem,
  IncidentSeverity,
  IncidentStatus,
} from "@/features/live-signal-inbox/model";

interface IncidentListViewProps {
  initialIncidents: IncidentListItem[];
}

export function IncidentListView({ initialIncidents }: IncidentListViewProps) {
  const router = useRouter();
  const [incidents, setIncidents] = useState<IncidentListItem[]>(initialIncidents);
  const [statusFilter, setStatusFilter] = useState<"all" | IncidentStatus>("all");
  const [severityFilter, setSeverityFilter] = useState<"all" | IncidentSeverity>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Diagnostic Probe State
  const [showDiagnosticModal, setShowDiagnosticModal] = useState(false);
  const [probeUrl, setProbeUrl] = useState("https://httpstat.us/503");
  const [probeMethod, setProbeMethod] = useState<"GET" | "POST">("GET");
  const [probeLoading, setProbeLoading] = useState(false);
  const [probeResult, setProbeResult] = useState<{
    success: boolean;
    message: string;
    status?: number | null;
    durationMs?: number;
  } | null>(null);

  const stats = useMemo(() => {
    let openCount = 0;
    let unresolvedHighOrCriticalCount = 0;
    let resolvedHighOrCriticalCount = 0;
    let acknowledgedCount = 0;
    let resolvedCount = 0;

    for (const inc of incidents) {
      if (inc.status === "open") openCount++;
      if (inc.status === "acknowledged") acknowledgedCount++;
      if (inc.status === "resolved") resolvedCount++;

      const isHighOrCritical = inc.severity === "critical" || inc.severity === "high";
      if (isHighOrCritical) {
        if (inc.status === "resolved") {
          resolvedHighOrCriticalCount++;
        } else {
          unresolvedHighOrCriticalCount++;
        }
      }
    }

    return {
      openCount,
      unresolvedHighOrCriticalCount,
      resolvedHighOrCriticalCount,
      acknowledgedCount,
      resolvedCount,
      total: incidents.length,
    };
  }, [incidents]);

  const filteredIncidents = useMemo(() => {
    return incidents.filter((inc) => {
      if (statusFilter !== "all" && inc.status !== statusFilter) return false;
      if (severityFilter !== "all" && inc.severity !== severityFilter) return false;
      if (searchQuery.trim() !== "") {
        const query = searchQuery.toLowerCase();
        const matchesTitle = inc.title.toLowerCase().includes(query);
        const matchesSource = inc.source.toLowerCase().includes(query);
        const matchesOp = inc.operation.toLowerCase().includes(query);
        const matchesSignalKey = inc.signalKey?.toLowerCase().includes(query) ?? false;
        if (!matchesTitle && !matchesSource && !matchesOp && !matchesSignalKey) return false;
      }
      return true;
    });
  }, [incidents, statusFilter, severityFilter, searchQuery]);

  async function handleRefresh() {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/signals");
      if (res.ok) {
        const data = (await res.json()) as { ok: boolean; incidents: IncidentListItem[] };
        if (data.ok && Array.isArray(data.incidents)) {
          setIncidents(data.incidents);
        }
      }
      router.refresh();
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleRunDiagnostic(e: React.FormEvent) {
    e.preventDefault();
    setProbeLoading(true);
    setProbeResult(null);

    try {
      const res = await fetch("/api/signals/diagnostic", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetUrl: probeUrl,
          method: probeMethod,
          timeoutMs: 5000,
          source: "diagnostic-probe",
          operation: "upstream-health-check",
          signalKey: "vendor-registry",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setProbeResult({
          success: false,
          message: data.message ?? "Diagnostic probe failed to execute.",
        });
        return;
      }

      if (data.ok && data.observation) {
        const obs = data.observation;
        if (obs.ok) {
          setProbeResult({
            success: true,
            status: obs.status,
            durationMs: obs.durationMs,
            message: `Probe returned HTTP ${obs.status} in ${obs.durationMs}ms (healthy).`,
          });
        } else {
          setProbeResult({
            success: true,
            status: obs.status,
            message: `Probe captured HTTP failure (${obs.failureCategory}) and created diagnostic incident.`,
          });
          await handleRefresh();
        }
      }
    } catch (err) {
      setProbeResult({
        success: false,
        message: err instanceof Error ? err.message : "Network error executing diagnostic probe.",
      });
    } finally {
      setProbeLoading(false);
    }
  }

  return (
    <div className="inbox-container">
      {/* Header */}
      <header className="inbox-header">
        <div>
          <div className="inbox-title-group">
            <h1 className="inbox-title">Live Signal Inbox</h1>
            <span className="badge badge-provenance-live">Module 004 Active</span>
          </div>
          <p className="inbox-subtitle">
            Reliable server-side HTTP observation boundary and deterministic incident correlation for upstream integrations.
          </p>
        </div>
        <div className="inbox-actions">
          <button
            type="button"
            className="button button-quiet"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? "Refreshing…" : "Refresh"}
          </button>
          <button
            type="button"
            className="button button-accent"
            onClick={() => {
              setProbeResult(null);
              setShowDiagnosticModal(true);
            }}
          >
            Run Diagnostic Probe
          </button>
        </div>
      </header>

      {/* Stats Bar */}
      <section className="inbox-stats-grid" aria-label="Incident Summary Statistics">
        <div className="stat-card">
          <span className="stat-label">Open Incidents</span>
          <span className="stat-value stat-value-open">{stats.openCount}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Critical / High (Unresolved)</span>
          <span className="stat-value stat-value-high">{stats.unresolvedHighOrCriticalCount}</span>
          <span className="stat-sub">
            {stats.resolvedHighOrCriticalCount} historical resolved
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Acknowledged</span>
          <span className="stat-value stat-value-ack">{stats.acknowledgedCount}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Resolved</span>
          <span className="stat-value stat-value-resolved">{stats.resolvedCount}</span>
        </div>
      </section>

      {/* Filter and Search Bar */}
      <div className="inbox-toolbar">
        <div className="inbox-tabs" role="tablist">
          <button
            type="button"
            className={`tab-button ${statusFilter === "all" ? "active" : ""}`}
            onClick={() => setStatusFilter("all")}
          >
            All ({stats.total})
          </button>
          <button
            type="button"
            className={`tab-button ${statusFilter === "open" ? "active" : ""}`}
            onClick={() => setStatusFilter("open")}
          >
            Open ({stats.openCount})
          </button>
          <button
            type="button"
            className={`tab-button ${statusFilter === "acknowledged" ? "active" : ""}`}
            onClick={() => setStatusFilter("acknowledged")}
          >
            Acknowledged ({stats.acknowledgedCount})
          </button>
          <button
            type="button"
            className={`tab-button ${statusFilter === "resolved" ? "active" : ""}`}
            onClick={() => setStatusFilter("resolved")}
          >
            Resolved ({stats.resolvedCount})
          </button>
        </div>

        <div className="inbox-filters">
          <select
            className="select-filter"
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as "all" | IncidentSeverity)}
            aria-label="Filter by severity"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <input
            type="search"
            className="search-input"
            placeholder="Search by title, source, or operation…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search incidents"
          />
        </div>
      </div>

      {/* Incident List */}
      {filteredIncidents.length === 0 ? (
        <div className="inbox-empty-card" role="status">
          <div className="empty-icon-circle">
            <span aria-hidden="true">✓</span>
          </div>
          <h2 className="empty-title">
            {incidents.length === 0 ? "No incidents detected" : "No matching incidents"}
          </h2>
          <p className="empty-description">
            {incidents.length === 0
              ? "All upstream integrations are healthy or no live providers are currently configured."
              : "No incidents matched your selected status and severity filters."}
          </p>
          <p className="empty-safeguard-notice">
            REPATHRA does not manufacture simulated live failures. When real HTTP error responses or transport failures are observed, authentic evidence is ingested and presented here.
          </p>
          {incidents.length === 0 && (
            <button
              type="button"
              className="button button-accent button-sm"
              onClick={() => {
                setProbeResult(null);
                setShowDiagnosticModal(true);
              }}
            >
              Execute Diagnostic Probe
            </button>
          )}
        </div>
      ) : (
        <div className="incident-card-list">
          {filteredIncidents.map((inc) => (
            <Link
              key={inc.id}
              href={`/signals/${inc.id}`}
              className={`incident-row-card incident-status-${inc.status}`}
            >
              <div className="incident-card-top">
                <div className="incident-badges">
                  <span className={`badge-status badge-status-${inc.status}`}>
                    {inc.status.toUpperCase()}
                  </span>
                  <span className={`badge-severity badge-severity-${inc.severity}`}>
                    {inc.severity.toUpperCase()}
                  </span>
                  {inc.latestSignalSummary?.provenance === "diagnostic" ? (
                    <span className="badge-provenance-diagnostic">
                      DIAGNOSTIC
                    </span>
                  ) : (
                    <span className="badge-provenance-live">
                      LIVE
                    </span>
                  )}
                  <span className="badge-source">
                    {inc.source} [{inc.operation}]
                  </span>
                  {inc.signalKey && (
                    <span className="badge-signalkey">
                      signalKey: {inc.signalKey}
                    </span>
                  )}
                </div>
                <div className="incident-meta-right">
                  <span className="occurrence-badge">
                    {inc.occurrenceCount} {inc.occurrenceCount === 1 ? "occurrence" : "occurrences"}
                  </span>
                  <time className="time-text">
                    Last seen {new Date(inc.lastSeenAt).toLocaleTimeString()}
                  </time>
                </div>
              </div>

              <h2 className="incident-card-title">{inc.title}</h2>

              {inc.latestSignalSummary && (
                <div className="latest-telemetry-preview">
                  <span className="telemetry-chip">
                    {inc.latestSignalSummary.httpMethod}
                  </span>
                  {inc.latestSignalSummary.httpStatus && (
                    <span className="telemetry-chip telemetry-status">
                      HTTP {inc.latestSignalSummary.httpStatus}
                    </span>
                  )}
                  <span className="telemetry-chip">
                    {inc.latestSignalSummary.durationMs}ms
                  </span>
                  <span className="telemetry-chip">
                    {inc.latestSignalSummary.failureCategory}
                  </span>
                </div>
              )}
            </Link>
          ))}
        </div>
      )}

      {/* Diagnostic Probe Modal */}
      {showDiagnosticModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-dialog">
            <div className="modal-header">
              <h2>Controlled Diagnostic Probe</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowDiagnosticModal(false)}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <p className="modal-explanation">
              Execute a real, verifiable outbound HTTP request through the observation boundary. Any recorded incident will be strictly tagged with <strong>diagnostic provenance</strong> to preserve telemetry integrity.
            </p>

            <form onSubmit={handleRunDiagnostic} className="diagnostic-form">
              <div className="form-group">
                <label htmlFor="probe-url">Target Endpoint URL</label>
                <input
                  id="probe-url"
                  type="url"
                  className="input-text"
                  value={probeUrl}
                  onChange={(e) => setProbeUrl(e.target.value)}
                  required
                />
                <span className="form-help">
                  Example: <code>https://httpstat.us/503</code> (fails with HTTP 503) or <code>https://httpstat.us/200</code> (healthy).
                </span>
              </div>

              <div className="form-group">
                <label htmlFor="probe-method">HTTP Method</label>
                <select
                  id="probe-method"
                  className="select-filter"
                  value={probeMethod}
                  onChange={(e) => setProbeMethod(e.target.value as "GET" | "POST")}
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                </select>
              </div>

              {probeResult && (
                <div
                  className={`probe-result-box ${probeResult.success ? "probe-success" : "probe-error"}`}
                >
                  <strong>{probeResult.success ? "Observation Completed:" : "Probe Error:"}</strong>
                  <p>{probeResult.message}</p>
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="button button-quiet"
                  onClick={() => setShowDiagnosticModal(false)}
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="button button-accent"
                  disabled={probeLoading}
                >
                  {probeLoading ? "Probing Target…" : "Execute Diagnostic Call"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
