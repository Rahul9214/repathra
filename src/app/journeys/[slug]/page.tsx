import { Suspense } from "react";

import { BoardLoading } from "@/components/studio/chrome";
import { JourneyBoard } from "@/components/studio/journey-board";

export default function JourneyPage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <main id="board">
      <Suspense fallback={<BoardLoading label="Opening the journey" />}>
        <JourneyBoard params={params} />
      </Suspense>
    </main>
  );
}
