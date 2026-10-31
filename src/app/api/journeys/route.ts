import { beginJourneyRequest, createJourneyResponse, listJourneysResponse, readJsonBody, isOperationFailure, operationGuard } from "@/platform/journeys/http";

export async function GET() {
  await beginJourneyRequest();
  return listJourneysResponse();
}

export async function POST(request: Request) {
  await beginJourneyRequest();
  const body = await readJsonBody(request);
  if (isOperationFailure(body)) return operationGuard(body);
  return createJourneyResponse(body);
}
