import {
  beginSignalRequest,
  isSignalOperationFailure,
  readSignalJsonBody,
  resolveIncidentResponse,
  signalResponse,
} from "@/platform/signals/http";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  await beginSignalRequest();
  const { id } = await params;
  const body = await readSignalJsonBody(request);
  if (isSignalOperationFailure(body)) return signalResponse(body);
  return resolveIncidentResponse(id, body);
}
