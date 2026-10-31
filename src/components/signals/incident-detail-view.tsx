"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import type {
  IncidentDetail,
  IncidentRecord,
} from "@/features/live-signal-inbox/model";

interface IncidentDetailViewProps {
  initialDetail: IncidentDetail;
}

export function IncidentDetailView({ initialDetail }: IncidentDetailViewProps) {
  const router = useRouter();
  const [detail, setDetail] = useState<IncidentDetail>(initialDetail);
  const [isActing, setIsActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Resolve Modal State
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolutionNote, setResolutionNote] = useState("");

  const { incident, signals, events, associatedRuns } = detail;

  async function handleAcknowledge() {
    setIsActing(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/signals/${incident.id}/acknowledge`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ notes: "Acknowledged via Signal Inbox operator console." }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.message ?? "Failed to acknowledge incident.");
        return;
      }
      if (data.ok && data.incident) {
        setDetail((prev) => ({
          ...prev,
          incident: data.incident as IncidentRecord,
        }));
        router.refresh();
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Network error.");
    } finally {
      setIsActing(false);
    }
  }

  async function handleResolve(e: React.FormEvent) {
    e.preventDefault();
    if (resolutionNote.trim().length < 3) {
      setActionError("Resolution note must be at least 3 characters.");
      return;
    }

    setIsActing(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/signals/${incident.id}/resolve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resolutionNote: resolutionNote.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.message ?? "Failed to resolve incident.");
        return;
      }
      if (data.ok && data.incident) {
        setDetail((prev) => ({
          ...prev,
          incident: data.incident as IncidentRecord,
        }));
        setShowResolveModal(false);
        setResolutionNote("");
        router.refresh();
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Network error.");
    } finally {
      setIsActing(false);
    }
  }

  return (
    <div className="incident-detail-container">
      {/* Back Link */}
      <nav className="detail-breadcrumb" aria-label="Breadcrumb">
        <Link href="/signals" className="back-link">
          ← Back to Signal Inbox
        </Link>
      </nav>

      {/* Incident Header Card */}
      <section className="detail-header-card">
        <div className="detail-header-top">
          <div className="incident-badges">
            <span className={`badge-status badge-status-${incident.status}`}>
              {incident.status.toUpperCase()}
            </span>
            <span className={`badge-severity badge-severity-${incident.severity}`}>
              {incident.severity.toUpperCase()}
            </span>
            <span className="badge-source">
              {incident.source} [{incident.operation}]
            </span>
            {incident.signalKey && (
              <span className="badge-signalkey">
                signalKey: {incident.signalKey}
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="detail-action-bar">
            {incident.status === "open" && (
              <button
                type="button"
                className="button button-quiet"
                onClick={handleAcknowledge}
                disabled={isActing}
              >
                {isActing ? "Acknowledging…" : "Acknowledge"}
              </button>
            )}
            {incident.status !== "resolved" && (
              <button
                type="button"
                className="button button-accent"
                onClick={() => {
                  setActionError(null);
                  setShowResolveModal(true);
                }}
                disabled={isActing}
              >
                Resolve Incident
              </button>
            )}
          </div>
        </div>

        <h1 className="detail-title">{incident.title}</h1>

        <div className="detail-meta-grid">
          <div>
            <span className="meta-key">Total Occurrences</span>
            <span className="meta-value">{incident.occurrenceCount}</span>
          </div>
          <div>
            <span className="meta-key">First Seen</span>
            <span className="meta-value">{new Date(incident.firstSeenAt).toLocaleString()}</span>
          </div>
          <div>
            <span className="meta-key">Last Seen</span>
            <span className="meta-value">{new Date(incident.lastSeenAt).toLocaleString()}</span>
          </div>
          <div>
            <span className="meta-key">Fingerprint</span>
            <span className="meta-value font-mono text-xs">{incident.fingerprint.slice(0, 16)}…</span>
          </div>
        </div>

        {actionError && (
          <div className="action-error-banner" role="alert">
            {actionError}
          </div>
        )}

        {incident.status === "resolved" && (
          <div className="resolution-banner">
            <div className="resolution-banner-header">
              <span className="resolution-check">✓</span>
              <strong>Resolved by {incident.resolvedBy ?? "operator"}</strong>
              <time className="time-text">
                {incident.resolvedAt ? new Date(incident.resolvedAt).toLocaleString() : ""}
              </time>
            </div>
            <p className="resolution-note-text">
              Note: {incident.resolutionNote}
            </p>
          </div>
        )}
      </section>

      {/* Correlated Workflows (Module 003 Relationship) */}
      <section className="detail-section">
        <div className="section-title-group">
          <h2 className="section-title">Correlated Workflow Runs</h2>
          <span className="badge badge-quiet">{associatedRuns.length} Correlated</span>
        </div>

        <div className="safeguard-callout" role="note">
          <div className="safeguard-badge">REPATHRA Safeguard</div>
          <p>
            Incidents are correlated for operator situational awareness. Workflow execution is <strong>not auto-advanced in Module 004</strong>. All deterministic state transitions and owner boundaries from Module 003 remain preserved.
          </p>
        </div>

        {associatedRuns.length === 0 ? (
          <div className="runs-empty-state">
            <p>No active journey runs are currently paused on this signal key.</p>
          </div>
        ) : (
          <div className="associated-runs-grid">
            {associatedRuns.map((run) => (
              <div key={run.runId} className="associated-run-card">
                <div className="associated-run-header">
                  <span className="badge badge-status-paused">PAUSED</span>
                  <span className="run-id-label font-mono">Run: {run.runId.slice(0, 8)}…</span>
                </div>
                <div className="associated-run-body">
                  <p><strong>Step:</strong> <code>{run.currentStepId}</code></p>
                  <p><strong>Owner:</strong> {run.ownerId}</p>
                  <p><strong>Updated:</strong> {new Date(run.updatedAt).toLocaleTimeString()}</p>
                </div>
                <div className="associated-run-footer">
                  <Link href={`/runs/${run.runId}`} className="button button-quiet button-sm">
                    Inspect Journey Run →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Evidence Dossier */}
      <section className="detail-section">
        <div className="section-title-group">
          <h2 className="section-title">Evidence Dossier</h2>
          <span className="badge badge-quiet">{signals.length} Captured Signals</span>
        </div>

        <div className="evidence-list">
          {signals.map((sig, idx) => (
            <article key={sig.id} className="evidence-card">
              <div className="evidence-header">
                <div className="evidence-badge-group">
                  <span className="badge-index">#{signals.length - idx}</span>
                  <span className={`badge-provenance badge-provenance-${sig.provenance}`}>
                    {sig.provenance.toUpperCase()}
                  </span>
                  <span className="evidence-method">{sig.httpMethod}</span>
                  {sig.httpStatus && (
                    <span className="evidence-status">
                      HTTP {sig.httpStatus}
                    </span>
                  )}
                  <span className="evidence-duration">{sig.durationMs}ms</span>
                </div>
                <time className="time-text">
                  {new Date(sig.occurredAt).toLocaleString()}
                </time>
              </div>

              <div className="evidence-url-row font-mono">
                <code>{sig.httpUrl}</code>
              </div>

              {sig.telemetry.errorMessage && (
                <div className="evidence-error-message">
                  <strong>Error:</strong> {sig.telemetry.errorMessage}
                </div>
              )}

              {/* Redacted Headers Telemetry */}
              <div className="telemetry-dossier">
                <details className="telemetry-details">
                  <summary className="telemetry-summary">
                    View Sanitized Telemetry &amp; Redacted Headers
                  </summary>
                  <div className="telemetry-content">
                    {sig.telemetry.requestHeaders && (
                      <div className="headers-block">
                        <h4>Request Headers (Sanitized)</h4>
                        <pre className="font-mono text-xs">
                          {JSON.stringify(sig.telemetry.requestHeaders, null, 2)}
                        </pre>
                      </div>
                    )}
                    {sig.telemetry.responseHeaders && (
                      <div className="headers-block">
                        <h4>Response Headers (Sanitized)</h4>
                        <pre className="font-mono text-xs">
                          {JSON.stringify(sig.telemetry.responseHeaders, null, 2)}
                        </pre>
                      </div>
                    )}
                    <div className="identifiers-block">
                      {sig.correlationId && (
                        <p><strong>Correlation ID:</strong> <code>{sig.correlationId}</code></p>
                      )}
                      {sig.idempotencyKey && (
                        <p><strong>Idempotency Key:</strong> <code>{sig.idempotencyKey}</code></p>
                      )}
                    </div>
                  </div>
                </details>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Chronological Activity & Audit Log */}
      <section className="detail-section">
        <h2 className="section-title">Activity &amp; Audit Log</h2>
        <div className="audit-timeline">
          {events.map((evt) => (
            <div key={evt.id} className="timeline-item">
              <div className="timeline-dot" />
              <div className="timeline-content">
                <div className="timeline-header">
                  <span className="timeline-event-type font-mono">{evt.eventType}</span>
                  <span className="timeline-actor">by {evt.actorId}</span>
                  <time className="time-text">{new Date(evt.createdAt).toLocaleString()}</time>
                </div>
                {evt.notes && <p className="timeline-notes">{evt.notes}</p>}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Resolve Incident Modal */}
      {showResolveModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-dialog">
            <div className="modal-header">
              <h2>Resolve Incident</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowResolveModal(false)}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <p className="modal-explanation">
              Resolving an incident records a permanent audit event. A verified resolution note describing the root cause or confirmed recovery is required.
            </p>

            <form onSubmit={handleResolve} className="diagnostic-form">
              <div className="form-group">
                <label htmlFor="resolution-note">Resolution Note (Required, min 3 characters)</label>
                <textarea
                  id="resolution-note"
                  className="input-textarea"
                  rows={4}
                  placeholder="e.g. Upstream vendor registry returned 200 OK after failover to secondary replica."
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  required
                />
              </div>

              {actionError && (
                <div className="action-error-banner" role="alert">
                  {actionError}
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="button button-quiet"
                  onClick={() => setShowResolveModal(false)}
                  disabled={isActing}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button button-accent"
                  disabled={isActing || resolutionNote.trim().length < 3}
                >
                  {isActing ? "Resolving…" : "Confirm Resolution"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
