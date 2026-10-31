import { describe, expect, it } from "vitest";

import { GET as getIncidents, POST as postSignal } from "@/app/api/signals/route";
import { GET as getIncidentDetail } from "@/app/api/signals/[id]/route";
import { POST as postAcknowledge } from "@/app/api/signals/[id]/acknowledge/route";
import { POST as postResolve } from "@/app/api/signals/[id]/resolve/route";
import { POST as postDiagnostic } from "@/app/api/signals/diagnostic/route";

describe("Signals API routes authentication and input guards", () => {
  it("rejects unauthenticated requests to GET /api/signals when auth is unconfigured or anonymous", async () => {
    const request = new Request("http://localhost/api/signals");
    const response = await getIncidents(request);
    expect([401, 403, 503]).toContain(response.status);
    const data = (await response.json()) as { ok: boolean; code: string };
    expect(data.ok).toBe(false);
    expect(["auth_not_configured", "unauthenticated", "forbidden_operator_required"]).toContain(data.code);
  });

  it("rejects invalid JSON payloads on POST /api/signals", async () => {
    const badRequest = new Request("http://localhost/api/signals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "MALFORMED_JSON{",
    });
    const response = await postSignal(badRequest);
    expect(response.status).toBe(400);
    const data = (await response.json()) as { ok: boolean; code: string };
    expect(data.ok).toBe(false);
    expect(data.code).toBe("invalid_json");
  });

  it("rejects unauthenticated webhook calls with invalid or missing secret", async () => {
    const webhookReq = new Request("http://localhost/api/signals", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-webhook-auth": "wrong-secret",
      },
      body: JSON.stringify({
        source: "vendor-registry",
        operation: "health-check",
      }),
    });
    const response = await postSignal(webhookReq);
    expect([401, 503]).toContain(response.status);
    const data = (await response.json()) as { ok: boolean; code: string };
    expect(data.ok).toBe(false);
  });

  it("rejects unauthenticated calls on GET /api/signals/[id]", async () => {
    const fakeParams = Promise.resolve({ id: "00000000-0000-0000-0000-000000000000" });
    const response = await getIncidentDetail(new Request("http://localhost/api/signals/test"), {
      params: fakeParams,
    });
    expect([401, 403, 503]).toContain(response.status);
    const data = (await response.json()) as { ok: boolean; code: string };
    expect(data.ok).toBe(false);
    expect(["auth_not_configured", "unauthenticated", "forbidden_operator_required"]).toContain(data.code);
  });

  it("rejects unauthenticated calls on POST /api/signals/[id]/acknowledge", async () => {
    const fakeParams = Promise.resolve({ id: "00000000-0000-0000-0000-000000000000" });
    const response = await postAcknowledge(
      new Request("http://localhost/api/signals/test/acknowledge", { method: "POST" }),
      { params: fakeParams },
    );
    expect([401, 403, 503]).toContain(response.status);
    const data = (await response.json()) as { ok: boolean; code: string };
    expect(data.ok).toBe(false);
    expect(["auth_not_configured", "unauthenticated", "forbidden_operator_required"]).toContain(data.code);
  });

  it("rejects unauthenticated calls on POST /api/signals/[id]/resolve", async () => {
    const fakeParams = Promise.resolve({ id: "00000000-0000-0000-0000-000000000000" });
    const response = await postResolve(
      new Request("http://localhost/api/signals/test/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resolutionNote: "Resolved incident." }),
      }),
      { params: fakeParams },
    );
    expect([401, 403, 503]).toContain(response.status);
    const data = (await response.json()) as { ok: boolean; code: string };
    expect(data.ok).toBe(false);
    expect(["auth_not_configured", "unauthenticated", "forbidden_operator_required"]).toContain(data.code);
  });

  it("rejects unauthenticated calls on POST /api/signals/diagnostic", async () => {
    const response = await postDiagnostic(
      new Request("http://localhost/api/signals/diagnostic", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetUrl: "https://example.com" }),
      }),
    );
    expect([401, 403, 503]).toContain(response.status);
    const data = (await response.json()) as { ok: boolean; code: string };
    expect(data.ok).toBe(false);
    expect(["auth_not_configured", "unauthenticated", "forbidden_operator_required"]).toContain(data.code);
  });
});
