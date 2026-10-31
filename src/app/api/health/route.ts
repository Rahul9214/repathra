import { connection } from "next/server";

import { buildHealthReport } from "@/platform/health/report";
import { probeDatabase } from "@/shared/db/probe";

export async function GET() {
  await connection();

  const result = await buildHealthReport({
    env: process.env,
    probe: probeDatabase,
  });

  return Response.json(result.body, {
    status: result.httpStatus,
    headers: {
      "cache-control": "no-store",
    },
  });
}
