import {
  acknowledgeIncidentResponse,
  beginSignalRequest,
  isSignalOperationFailure,
  readSignalJsonBody,
  signalResponse,
} from "@/platform/signals/http";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  await beginSignalRequest();
  const { id } = await params;
  let body: unknown = {};
  if (request.headers.get("content-length") && request.headers.get("content-length") !== "0") {
    body = await readSignalJsonBody(request);
    if (isSignalOperationFailure(body)) return signalResponse(body);
  }
  return acknowledgeIncidentResponse(id, body);
}
