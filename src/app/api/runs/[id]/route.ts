import { beginRunRequest, readRunDetailResponse } from "@/platform/runs/http";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  await beginRunRequest();
  const { id } = await params;
  return readRunDetailResponse(id);
}
