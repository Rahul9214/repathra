import { notFound } from "next/navigation";
import { connection } from "next/server";

import { DraftEditor } from "@/components/studio/draft-editor";
import { PublishedViewer } from "@/components/studio/published-viewer";
import { OperatorAccessCard } from "@/components/studio/clerk-operator";
import { StatePanel } from "@/components/studio/chrome";
import { readJourney, readPublishedVersion } from "@/platform/journeys/live";

export async function JourneyBoard({ params }: { params: Promise<{ slug: string }> }) {
  await connection();
  const { slug } = await params;
  const result = await readJourney(slug);
  if (!result.ok && result.code === "not_found") notFound();
  if (!result.ok) {
    return <StatePanel tone="error" title="Workflow Unavailable" message={result.message} />;
  }

  const { journey, draftAccess } = result;
  const latest = journey.versions.at(-1) ?? null;
  const isOperator = draftAccess === "allowed";

  // If the user is an authorized operator and has a draft:
  if (isOperator && journey.draft) {
    return (
      <DraftEditor
        slug={journey.slug}
        revision={journey.draft.revision}
        document={journey.draft.document}
        locked={false}
        lockMessage={null}
        draftAccess={draftAccess}
        versions={journey.versions}
      />
    );
  }

  // If there is an active published version, display it via PublishedViewer
  if (latest) {
    return (
      <PublishedViewer
        slug={journey.slug}
        title={journey.title}
        summary={journey.summary}
        versionNumber={latest.versionNumber}
        publishedAt={latest.publishedAt}
        publishedBy={latest.publishedBy}
        document={latest.document}
        versions={journey.versions}
        isCurrent={true}
        canEdit={isOperator}
        origin={journey.origin}
        sandboxNotice={journey.sandboxNotice}
      />
    );
  }

  // If draft exists but user is not authorized, they must sign in or see access card
  if (draftAccess === "unauthenticated" || draftAccess === "unauthorized" || draftAccess === "auth_not_configured") {
    return <OperatorAccessCard gate={draftAccess} />;
  }

  return (
    <StatePanel
      title="Workflow Not Yet Published"
      message="This journey is currently in development and has no active published version."
    />
  );
}

export async function PublishedVersionBoard({
  params,
}: {
  params: Promise<{ slug: string; version: string }>;
}) {
  await connection();
  const { slug, version } = await params;
  if (!/^[1-9][0-9]*$/.test(version)) notFound();
  const result = await readPublishedVersion(slug, Number(version));
  if (!result.ok && (result.code === "version_not_found" || result.code === "not_found")) notFound();
  if (!result.ok) {
    return <StatePanel tone="error" title="Historical Snapshot Unavailable" message={result.message} />;
  }

  return (
    <PublishedViewer
      slug={result.slug}
      title={result.version.document.title}
      summary={result.version.document.summary}
      versionNumber={result.version.versionNumber}
      publishedAt={result.version.publishedAt}
      publishedBy={result.version.publishedBy}
      document={result.version.document}
      versions={[result.version]}
      isCurrent={false}
      canEdit={false}
      origin={result.origin}
      sandboxNotice={result.sandboxNotice}
    />
  );
}
