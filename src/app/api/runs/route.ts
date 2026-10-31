import {
  beginRunRequest,
  isRunOperationFailure,
  listRunsResponse,
  readRunJsonBody,
  runOperationGuard,
  startRunResponse,
} from "@/platform/runs/http";

export async function GET(): Promise<Response> {
  await beginRunRequest();
  return listRunsResponse();
}

export async function POST(request: Request): Promise<Response> {
  await beginRunRequest();
  const body = await readRunJsonBody(request);
  if (isRunOperationFailure(body)) return runOperationGuard(body);
  return startRunResponse(body);
}
