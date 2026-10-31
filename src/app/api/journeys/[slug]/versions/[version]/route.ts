import { beginJourneyRequest, publishedVersionResponse } from "@/platform/journeys/http";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string; version: string }> },
) {
  await beginJourneyRequest();
  const { slug, version } = await context.params;
  return publishedVersionResponse(slug, version);
}
