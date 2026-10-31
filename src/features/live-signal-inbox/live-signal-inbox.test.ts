import { describe, expect, it } from "vitest";

import {
  classifyHttpFailure,
  deriveIncidentTitle,
  generateIncidentFingerprint,
} from "./classifier";
import {
  isAllowedOutboundUrl,
  sanitizeHeaders,
  sanitizeUrl,
} from "./observation";
import {
  captureSignalSchema,
  incidentActionSchema,
  incidentFilterSchema,
} from "./schema";

describe("Live Signal Inbox - Pure Classification & Telemetry", () => {
  it("classifies HTTP 5xx errors deterministically", () => {
    const res503 = classifyHttpFailure({ status: 503, durationMs: 250 });
    expect(res503).toEqual({ failureCategory: "http_5xx", severity: "high" });

    const res500 = classifyHttpFailure({ status: 500, durationMs: 120 });
    expect(res500).toEqual({ failureCategory: "http_5xx", severity: "high" });

    const res505 = classifyHttpFailure({ status: 505, durationMs: 100 });
    expect(res505).toEqual({ failureCategory: "http_5xx", severity: "medium" });
  });

  it("classifies HTTP 4xx errors deterministically", () => {
    const res401 = classifyHttpFailure({ status: 401, durationMs: 80 });
    expect(res401).toEqual({ failureCategory: "http_4xx", severity: "high" });

    const res429 = classifyHttpFailure({ status: 429, durationMs: 50 });
    expect(res429).toEqual({ failureCategory: "http_4xx", severity: "medium" });

    const res404 = classifyHttpFailure({ status: 404, durationMs: 60 });
    expect(res404).toEqual({ failureCategory: "http_4xx", severity: "low" });
  });

  it("classifies timeouts and long durations with appropriate severity", () => {
    const shortTimeout = classifyHttpFailure({
      durationMs: 5000,
      timedOut: true,
      errorName: "AbortError",
    });
    expect(shortTimeout).toEqual({ failureCategory: "timeout", severity: "high" });

    const longTimeout = classifyHttpFailure({
      durationMs: 20000,
      timedOut: true,
      errorName: "AbortError",
    });
    expect(longTimeout).toEqual({ failureCategory: "timeout", severity: "critical" });
  });

  it("classifies network transport and TLS errors", () => {
    const networkErr = classifyHttpFailure({
      durationMs: 40,
      networkError: true,
      errorMessage: "connect ECONNREFUSED 10.0.0.1:443",
    });
    expect(networkErr).toEqual({ failureCategory: "network_error", severity: "high" });

    const tlsErr = classifyHttpFailure({
      durationMs: 75,
      tlsError: true,
      errorMessage: "UNABLE_TO_VERIFY_LEAF_SIGNATURE: certificate has expired",
    });
    expect(tlsErr).toEqual({ failureCategory: "tls_error", severity: "critical" });
  });

  it("generates deterministic incident fingerprints for correlation", () => {
    const fp1 = generateIncidentFingerprint({
      source: "vendor-registry",
      operation: "verify-organization",
      failureCategory: "http_5xx",
      signalKey: "vendor-registry",
    });
    const fp2 = generateIncidentFingerprint({
      source: "  VENDOR-REGISTRY  ",
      operation: "verify-organization",
      failureCategory: "http_5xx",
      signalKey: "vendor-registry",
    });
    const fpDifferentCategory = generateIncidentFingerprint({
      source: "vendor-registry",
      operation: "verify-organization",
      failureCategory: "timeout",
      signalKey: "vendor-registry",
    });

    expect(fp1).toBe(fp2);
    expect(fp1).not.toBe(fpDifferentCategory);
    expect(fp1).toHaveLength(64); // SHA-256
  });

  it("derives readable incident titles from telemetry", () => {
    const title = deriveIncidentTitle({
      source: "vendor-registry",
      operation: "verify-organization",
      failureCategory: "http_5xx",
      telemetry: {
        method: "POST",
        url: "https://api.vendor-registry.io/v1/check",
        status: 503,
        durationMs: 1420,
      },
    });
    expect(title).toContain("vendor-registry");
    expect(title).toContain("HTTP 503");
  });
});

describe("Live Signal Inbox - Sanitization & Security Boundary", () => {
  it("sanitizes sensitive headers strictly", () => {
    const headers = {
      Authorization: "Bearer secret-token-12345",
      "x-api-key": "super-secret-key",
      Cookie: "session=xyz987",
      "content-type": "application/json",
      "user-agent": "repathra-observer/1.0",
      "x-correlation-id": "corr-abc-123",
    };

    const sanitized = sanitizeHeaders(headers);
    expect(sanitized["authorization"]).toBe("[REDACTED]");
    expect(sanitized["x-api-key"]).toBe("[REDACTED]");
    expect(sanitized["cookie"]).toBe("[REDACTED]");
    expect(sanitized["content-type"]).toBe("application/json");
    expect(sanitized["user-agent"]).toBe("repathra-observer/1.0");
    expect(sanitized["x-correlation-id"]).toBe("corr-abc-123");
  });

  it("sanitizes sensitive query params and user credentials in URLs", () => {
    const dirtyUrl = "https://user:password123@api.partner.com/v1/data?apiKey=secret-key-999&token=jwt-token-val&category=retail";
    const cleaned = sanitizeUrl(dirtyUrl);

    expect(cleaned).not.toContain("password123");
    expect(cleaned).not.toContain("secret-key-999");
    expect(cleaned).not.toContain("jwt-token-val");
    expect(cleaned).toContain("category=retail");
    expect(cleaned).toContain("apiKey=%5BREDACTED%5D");
  });

  it("enforces outbound URL allowlist policy against SSRF", () => {
    const disallowedProto = isAllowedOutboundUrl("ftp://api.example.com/file");
    expect(disallowedProto.allowed).toBe(false);

    const allowlistCheck = isAllowedOutboundUrl("https://evil.internal.attacker.com/data", {
      allowedHosts: ["api.vendor-registry.io", "sandbox.partner-api.com"],
    });
    expect(allowlistCheck.allowed).toBe(false);

    const permittedCheck = isAllowedOutboundUrl("https://api.vendor-registry.io/check", {
      allowedHosts: ["api.vendor-registry.io"],
    });
    expect(permittedCheck.allowed).toBe(true);
  });
});

describe("Live Signal Inbox - Zod Domain Schemas", () => {
  it("validates valid captured signal input", () => {
    const parsed = captureSignalSchema.safeParse({
      provenance: "observed_http",
      source: "vendor-registry",
      operation: "lookup",
      failureCategory: "http_5xx",
      telemetry: {
        method: "GET",
        url: "https://api.vendor-registry.io/v1/lookup",
        status: 500,
        durationMs: 312,
      },
    });
    expect(parsed.success).toBe(true);
  });

  it("validates incident actions and enforces resolution note on resolve", () => {
    const ack = incidentActionSchema.safeParse({ action: "acknowledge" });
    expect(ack.success).toBe(true);

    const resolveWithoutNote = incidentActionSchema.safeParse({ action: "resolve" });
    expect(resolveWithoutNote.success).toBe(false);

    const resolveWithShortNote = incidentActionSchema.safeParse({
      action: "resolve",
      resolutionNote: "ok",
    });
    expect(resolveWithShortNote.success).toBe(false);

    const resolveValid = incidentActionSchema.safeParse({
      action: "resolve",
      resolutionNote: "Upstream vendor registry service restarted and verified healthy.",
    });
    expect(resolveValid.success).toBe(true);
  });

  it("parses incident filter query parameters with defaults", () => {
    const filter = incidentFilterSchema.parse({
      status: "open",
      severity: "high",
      limit: "15",
      offset: "0",
    });
    expect(filter.status).toBe("open");
    expect(filter.severity).toBe("high");
    expect(filter.limit).toBe(15);
    expect(filter.offset).toBe(0);
  });
});
