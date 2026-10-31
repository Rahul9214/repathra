import { Suspense } from "react";
import { connection } from "next/server";

import { BoardLoading, StudioShell } from "@/components/studio/chrome";
import { OperatorAccessCard } from "@/components/studio/clerk-operator";
import { IncidentListView } from "@/components/signals/incident-list-view";
import { getCurrentOperatorAuth, openSignalDatabase } from "@/platform/signals/live";
import { listStoredIncidents } from "@/platform/signals/repository";

export default function SignalsPage() {
  return (
    <StudioShell>
      <main id="board">
        <Suspense fallback={<BoardLoading label="Loading Live Signal Inbox…" />}>
          <SignalsContent />
        </Suspense>
      </main>
    </StudioShell>
  );
}

async function SignalsContent() {
  await connection();

  const operator = await getCurrentOperatorAuth();
  if (!operator.ok) {
    if (operator.code === "auth_not_configured") {
      return (
        <div className="directory-workspace">
          <OperatorAccessCard gate="auth_not_configured" />
        </div>
      );
    }
    if (operator.code === "unauthenticated") {
      return (
        <div className="directory-workspace">
          <OperatorAccessCard gate="unauthenticated" />
        </div>
      );
    }
    return (
      <div className="directory-workspace">
        <OperatorAccessCard gate="unauthorized" />
      </div>
    );
  }

  const database = openSignalDatabase();
  if (!database.ok) {
    return (
      <div className="directory-workspace">
        <section className="state-panel is-error" role="alert">
          <h2>Database Offline</h2>
          <p>{database.message}</p>
        </section>
      </div>
    );
  }

  const { incidents } = await listStoredIncidents(database.connectionString);
  return <IncidentListView initialIncidents={incidents} />;
}
