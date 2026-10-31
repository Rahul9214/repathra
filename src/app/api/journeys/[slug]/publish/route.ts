import {
  beginJourneyRequest,
  isOperationFailure,
  operationGuard,
  publishResponse,
  readJsonBody,
} from "@/platform/journeys/http";

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  await beginJourneyRequest();
  const { slug } = await context.params;
  const body = await readJsonBody(request);
  if (isOperationFailure(body)) return operationGuard(body);
  return publishResponse(slug, body);
}
