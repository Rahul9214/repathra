import {
  beginRunRequest,
  executeStepResponse,
  isRunOperationFailure,
  readRunJsonBody,
  runOperationGuard,
} from "@/platform/runs/http";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  await beginRunRequest();
  const { id } = await params;
  const body = await readRunJsonBody(request);
  if (isRunOperationFailure(body)) return runOperationGuard(body);
  return executeStepResponse(id, body);
}
