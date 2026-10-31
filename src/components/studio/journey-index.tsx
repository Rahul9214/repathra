import { connection } from "next/server";

import { JourneyDirectory } from "@/components/studio/journey-directory";
import { StatePanel } from "@/components/studio/chrome";
import { listJourneys, operatorGate } from "@/platform/journeys/live";

export async function JourneyIndex() {
  await connection();
  const board = await listJourneys();
  const gate = await operatorGate();

  if (!board.ok) {
    return <StatePanel tone="error" title="Journeys Unavailable" message={board.message} />;
  }

  return <JourneyDirectory journeys={board.journeys} gate={gate} />;
}

