import { describe, expect, it } from "vitest";

import { GET as getRuns, POST as postRuns } from "@/app/api/runs/route";
import { GET as getRunDetail } from "@/app/api/runs/[id]/route";
import { POST as postRunStep } from "@/app/api/runs/[id]/step/route";

describe("Runs API routes authentication and input guards", () => {
  it("rejects unauthenticated requests to GET /api/runs when auth is unconfigured or anonymous", async () => {
    // In vitest environment without Clerk session, it must fail closed
    const response = await getRuns();
    expect([401, 503]).toContain(response.status);
    const data = (await response.json()) as { ok: boolean; code: string };
    expect(data.ok).toBe(false);
    expect(["auth_not_configured", "unauthenticated"]).toContain(data.code);
  });

  it("rejects invalid JSON payloads on POST /api/runs", async () => {
    const badRequest = new Request("http://localhost/api/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "INVALID_JSON{",
    });
    const response = await postRuns(badRequest);
    expect(response.status).toBe(400);
    const data = (await response.json()) as { ok: boolean; code: string };
    expect(data.ok).toBe(false);
    expect(data.code).toBe("invalid_json");
  });

  it("rejects unauthenticated calls on POST /api/runs with valid JSON", async () => {
    const validJsonReq = new Request("http://localhost/api/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        journeySlug: "vendor-onboarding",
        versionNumber: 1,
      }),
    });
    const response = await postRuns(validJsonReq);
    expect([401, 503]).toContain(response.status);
    const data = (await response.json()) as { ok: boolean; code: string };
    expect(data.ok).toBe(false);
    expect(["auth_not_configured", "unauthenticated"]).toContain(data.code);
  });

  it("rejects unauthenticated calls on GET /api/runs/[id]", async () => {
    const fakeParams = Promise.resolve({ id: "00000000-0000-0000-0000-000000000000" });
    const response = await getRunDetail(new Request("http://localhost/api/runs/test"), {
      params: fakeParams,
    });
    expect([401, 503]).toContain(response.status);
    const data = (await response.json()) as { ok: boolean; code: string };
    expect(data.ok).toBe(false);
    expect(["auth_not_configured", "unauthenticated"]).toContain(data.code);
  });

  it("rejects unauthenticated calls on POST /api/runs/[id]/step", async () => {
    const fakeParams = Promise.resolve({ id: "00000000-0000-0000-0000-000000000000" });
    const request = new Request("http://localhost/api/runs/test/step", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        expectedRevision: 1,
        action: { type: "collect", value: "Test" },
      }),
    });
    const response = await postRunStep(request, { params: fakeParams });
    expect([401, 503]).toContain(response.status);
    const data = (await response.json()) as { ok: boolean; code: string };
    expect(data.ok).toBe(false);
    expect(["auth_not_configured", "unauthenticated"]).toContain(data.code);
  });
});
