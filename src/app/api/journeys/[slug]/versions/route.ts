import { beginJourneyRequest } from "@/platform/journeys/http";
import { operationResponse, readJourney } from "@/platform/journeys/live";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  await beginJourneyRequest();
  const { slug } = await context.params;
  const result = await readJourney(slug);
  if (!result.ok) return operationResponse(result);
  return operationResponse({
    ok: true,
    slug,
    versions: result.journey.versions.map((version) => ({
      versionNumber: version.versionNumber,
      title: version.title,
      contentHash: version.contentHash,
      publishedBy: version.publishedBy,
      publishedAt: version.publishedAt,
    })),
  });
}
