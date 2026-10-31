import { Suspense } from "react";
import { connection } from "next/server";

import { BoardLoading } from "@/components/studio/chrome";
import { RunListView } from "@/components/runs/run-list-view";
import { listMyRuns } from "@/platform/runs/live";
import { readClerkConfig } from "@/shared/config/clerk";

export default function RunsPage() {
  return (
    <main id="board">
      <Suspense fallback={<BoardLoading label="Reading your active journeys" />}>
        <RunsIndex />
      </Suspense>
    </main>
  );
}

async function RunsIndex() {
  await connection();
  const clerk = readClerkConfig(process.env);
  if (!clerk.configured) {
    return <RunListView runs={[]} userState="auth_not_configured" />;
  }

  const result = await listMyRuns();
  if (!result.ok) {
    if (result.code === "unauthenticated") {
      return <RunListView runs={[]} userState="unauthenticated" />;
    }
    if (result.code === "auth_not_configured") {
      return <RunListView runs={[]} userState="auth_not_configured" />;
    }
    return (
      <div className="directory-workspace">
        <section className="state-panel is-error" role="alert">
          <h2>Could Not Load Journeys</h2>
          <p>{result.message}</p>
        </section>
      </div>
    );
  }

  return <RunListView runs={result.runs} userState="authenticated" />;
}
