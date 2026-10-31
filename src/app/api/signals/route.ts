import {
  beginSignalRequest,
  ingestSignalResponse,
  isSignalOperationFailure,
  listIncidentsResponse,
  readSignalJsonBody,
  signalResponse,
} from "@/platform/signals/http";

export async function GET(request: Request): Promise<Response> {
  await beginSignalRequest();
  return listIncidentsResponse(request);
}

export async function POST(request: Request): Promise<Response> {
  await beginSignalRequest();
  const body = await readSignalJsonBody(request);
  if (isSignalOperationFailure(body)) return signalResponse(body);
  return ingestSignalResponse(request, body);
}
