import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";

import { BoardLoading, StatePanel } from "@/components/studio/chrome";
import { RunRunner } from "@/components/runs/run-runner";
import { readRun } from "@/platform/runs/live";

export default function RunExecutionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <main id="board">
      <Suspense fallback={<BoardLoading label="Resuming your journey" />}>
        <RunLoader params={params} />
      </Suspense>
    </main>
  );
}

async function RunLoader({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const result = await readRun(id);

  if (!result.ok) {
    if (result.code === "unauthenticated") {
      return (
        <div className="directory-workspace">
          <StatePanel
            title="Sign In Required"
            message="You must be signed in with the owning account to view and resume this journey."
            tone="neutral"
          />
        </div>
      );
    }
    if (result.code === "unauthorized") {
      return (
        <div className="directory-workspace">
          <StatePanel
            title="Access Restricted"
            message="This journey belongs to another account. You cannot view or modify someone else's workflow."
            tone="error"
          />
          <div style={{ marginTop: "1rem" }}>
            <Link href="/runs" className="button button-secondary button-sm">
              Return to My Journeys
            </Link>
          </div>
        </div>
      );
    }
    if (result.code === "run_not_found") {
      return (
        <div className="directory-workspace">
          <StatePanel
            title="Journey Not Found"
            message="The requested journey run could not be found or has been removed."
            tone="error"
          />
          <div style={{ marginTop: "1rem" }}>
            <Link href="/runs" className="button button-secondary button-sm">
              Return to My Journeys
            </Link>
          </div>
        </div>
      );
    }
    return (
      <div className="directory-workspace">
        <StatePanel
          title="Could Not Resume Journey"
          message={result.message}
          tone="error"
        />
      </div>
    );
  }

  return <RunRunner initialDetail={result.detail} />;
}
