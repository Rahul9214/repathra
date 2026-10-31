import { Suspense } from "react";

import { BoardLoading } from "@/components/studio/chrome";
import { JourneyIndex } from "@/components/studio/journey-index";

export default function HomePage() {
  return (
    <main id="board">
      <Suspense fallback={<BoardLoading label="Reading the journey board" />}>
        <JourneyIndex />
      </Suspense>
    </main>
  );
}
