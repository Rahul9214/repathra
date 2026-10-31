import {
  beginSignalRequest,
  diagnosticProbeResponse,
  isSignalOperationFailure,
  readSignalJsonBody,
  signalResponse,
} from "@/platform/signals/http";

export async function POST(request: Request): Promise<Response> {
  await beginSignalRequest();
  const body = await readSignalJsonBody(request);
  if (isSignalOperationFailure(body)) return signalResponse(body);
  return diagnosticProbeResponse(body);
}
