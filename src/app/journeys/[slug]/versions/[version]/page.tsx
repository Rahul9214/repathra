import { Suspense } from "react";

import { BoardLoading } from "@/components/studio/chrome";
import { PublishedVersionBoard } from "@/components/studio/journey-board";

export default function PublishedVersionPage({
  params,
}: {
  params: Promise<{ slug: string; version: string }>;
}) {
  return (
    <main id="board">
      <Suspense fallback={<BoardLoading label="Opening the published version" />}>
        <PublishedVersionBoard params={params} />
      </Suspense>
    </main>
  );
}
