import type { ReactNode } from "react";
import Link from "next/link";
import { Suspense } from "react";

import { OperatorSlot } from "@/components/studio/operator-slot";
import { PRODUCT } from "@/shared/contracts/product";

export function StudioShell({ children }: { children: ReactNode }) {
  return (
    <div className="studio">
      <a className="skip" href="#board">
        Skip to main content
      </a>
      <nav className="studio-nav" aria-label="Studio Navigation">
        <div className="studio-brand-group">
          <Link href="/" className="studio-brand">
            {PRODUCT.name}
          </Link>
          <span className="brand-badge">Journey Studio</span>
          <div className="studio-nav-links">
            <Link href="/" className="nav-tab-link">
              Workflows
            </Link>
            <Link href="/runs" className="nav-tab-link">
              My Journeys
            </Link>
          </div>
        </div>
        <div className="nav-actions">
          <Suspense fallback={<span className="badge badge-status-draft">Checking operator…</span>}>
            <OperatorSlot />
          </Suspense>
        </div>
      </nav>
      {children}
      <footer className="colophon">
        <span>{PRODUCT.name} · {PRODUCT.tagline}</span>
        <a href="/api/health" className="button button-quiet button-sm">
          System Readiness
        </a>
      </footer>
    </div>
  );
}

export function BoardLoading({ label }: { label: string }) {
  return (
    <div className="board-loading" role="status" aria-live="polite">
      <span className="badge badge-status-draft">Loading</span>
      <p>{label}</p>
    </div>
  );
}

export function StatePanel({
  title,
  message,
  tone = "neutral",
}: {
  title: string;
  message: string;
  tone?: "neutral" | "error";
}) {
  return (
    <section
      className={tone === "error" ? "state-panel is-error" : "state-panel"}
      role={tone === "error" ? "alert" : "status"}
    >
      <h2>{title}</h2>
      <p>{message}</p>
    </section>
  );
}
