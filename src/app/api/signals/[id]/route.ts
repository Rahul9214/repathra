import {
  beginSignalRequest,
  readIncidentDetailResponse,
} from "@/platform/signals/http";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  await beginSignalRequest();
  const { id } = await params;
  return readIncidentDetailResponse(id);
}
