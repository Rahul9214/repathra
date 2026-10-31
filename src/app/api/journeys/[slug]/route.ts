import {
  beginJourneyRequest,
  journeyDetailResponse,
} from "@/platform/journeys/http";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  await beginJourneyRequest();
  const { slug } = await context.params;
  return journeyDetailResponse(slug);
}
