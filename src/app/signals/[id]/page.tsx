import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { BoardLoading } from "@/components/studio/chrome";
import { OperatorAccessCard } from "@/components/studio/clerk-operator";
import { IncidentDetailView } from "@/components/signals/incident-detail-view";
import { getCurrentOperatorAuth, openSignalDatabase } from "@/platform/signals/live";
import { readStoredIncident } from "@/platform/signals/repository";

export default async function IncidentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main id="board">
      <Suspense fallback={<BoardLoading label="Loading incident telemetry…" />}>
        <IncidentDetailContent id={id} />
      </Suspense>
    </main>
  );
}

async function IncidentDetailContent({ id }: { id: string }) {
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

  const detail = await readStoredIncident(database.connectionString, id);
  if (!detail) {
    notFound();
  }

  return <IncidentDetailView initialDetail={detail} />;
}
