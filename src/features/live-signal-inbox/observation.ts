import { classifyHttpFailure } from "./classifier";
import type {
  CapturedSignalInput,
  SanitizedTelemetry,
  SignalProvenance,
} from "./model";

const SENSITIVE_HEADER_KEYS = new Set([
  "authorization",
  "proxy-authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "apikey",
  "api-key",
  "x-auth-token",
  "x-client-secret",
  "session",
  "x-amz-security-token",
  "x-access-token",
  "x-signature",
]);

const SENSITIVE_QUERY_REGEX = /(key|token|secret|auth|password|signature|sig|credential|access_token|client_secret)/i;

export function sanitizeUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    // Strip userinfo if present
    parsed.username = "";
    parsed.password = "";

    // Mask sensitive query parameters
    const searchParams = new URLSearchParams(parsed.search);
    for (const [key] of Array.from(searchParams.entries())) {
      if (SENSITIVE_QUERY_REGEX.test(key)) {
        searchParams.set(key, "[REDACTED]");
      }
    }
    parsed.search = searchParams.toString();
    return parsed.toString();
  } catch {
    // If not a parseable URL, fallback to minimal regex mask
    return rawUrl.replace(/(token|key|secret|password)=[^&]*/gi, "$1=[REDACTED]");
  }
}

export function sanitizeHeaders(
  rawHeaders: HeadersInit | Record<string, string> | undefined,
): Record<string, string> {
  const result: Record<string, string> = {};
  if (!rawHeaders) return result;

  const entries: [string, string][] =
    rawHeaders instanceof Headers
      ? Array.from(rawHeaders.entries())
      : Array.isArray(rawHeaders)
        ? rawHeaders
        : Object.entries(rawHeaders);

  for (const [key, value] of entries) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_HEADER_KEYS.has(lowerKey)) {
      result[lowerKey] = "[REDACTED]";
    } else {
      result[lowerKey] = value;
    }
  }

  return result;
}

export interface OutboundTargetPolicy {
  allowedHosts?: readonly string[];
  allowLoopback?: boolean;
}

export function isAllowedOutboundUrl(
  urlStr: string,
  policy?: OutboundTargetPolicy,
): { allowed: boolean; reason?: string } {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { allowed: false, reason: `Unsupported protocol: ${parsed.protocol}` };
    }

    const host = parsed.hostname.toLowerCase();

    // Loopback handling for diagnostics / testing
    const isLoopback =
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host.endsWith(".localhost");

    if (isLoopback) {
      if (policy?.allowLoopback || process.env.NODE_ENV !== "production") {
        return { allowed: true };
      }
      return { allowed: false, reason: "Loopback targets disallowed in production" };
    }

    if (policy?.allowedHosts && policy.allowedHosts.length > 0) {
      const allowed = policy.allowedHosts.some(
        (allowedHost) => host === allowedHost.toLowerCase() || host.endsWith(`.${allowedHost.toLowerCase()}`),
      );
      if (!allowed) {
        return { allowed: false, reason: `Host ${host} is not on the allowed outbound hosts list` };
      }
    }

    return { allowed: true };
  } catch (err) {
    return { allowed: false, reason: `Invalid URL format: ${err instanceof Error ? err.message : String(err)}` };
  }
}

export interface ObserveHttpOptions {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  source: string;
  operation: string;
  signalKey?: string | null;
  runId?: string | null;
  correlationId?: string | null;
  idempotencyKey?: string | null;
  provenance?: SignalProvenance;
  metadata?: Record<string, unknown>;
  policy?: OutboundTargetPolicy;
}

export type ObserveHttpOutcome =
  | {
      ok: true;
      status: number;
      durationMs: number;
      telemetry: SanitizedTelemetry;
    }
  | {
      ok: false;
      signal: CapturedSignalInput;
    };

export async function observeHttpCall(
  options: ObserveHttpOptions,
): Promise<ObserveHttpOutcome> {
  const {
    url,
    method = "GET",
    headers = {},
    body,
    timeoutMs = 5000,
    source,
    operation,
    signalKey,
    runId,
    correlationId,
    idempotencyKey,
    provenance = "observed_http",
    metadata,
    policy,
  } = options;

  const sanitizedUrl = sanitizeUrl(url);
  const sanitizedRequestHeaders = sanitizeHeaders(headers);

  // Validate URL against SSRF policy
  const urlCheck = isAllowedOutboundUrl(url, policy);
  if (!urlCheck.allowed) {
    const telemetry: SanitizedTelemetry = {
      method,
      url: sanitizedUrl,
      status: null,
      durationMs: 0,
      errorName: "SSRF_POLICY_VIOLATION",
      errorMessage: urlCheck.reason ?? "Target host is disallowed by outbound security policy",
      requestHeaders: sanitizedRequestHeaders,
    };
    return {
      ok: false,
      signal: {
        provenance,
        source,
        operation,
        signalKey,
        runId,
        failureCategory: "payload_error",
        telemetry,
        correlationId,
        idempotencyKey,
        metadata: { ...metadata, policyViolation: true },
        occurredAt: new Date().toISOString(),
      },
    };
  }

  const start = performance.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: method !== "GET" && method !== "HEAD" ? body : undefined,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const durationMs = Math.round(performance.now() - start);

    const sanitizedResponseHeaders = sanitizeHeaders(response.headers);
    const telemetry: SanitizedTelemetry = {
      method,
      url: sanitizedUrl,
      status: response.status,
      durationMs,
      requestHeaders: sanitizedRequestHeaders,
      responseHeaders: sanitizedResponseHeaders,
    };

    if (response.ok) {
      return {
        ok: true,
        status: response.status,
        durationMs,
        telemetry,
      };
    }

    // Upstream returned 4xx or 5xx
    const classification = classifyHttpFailure({
      status: response.status,
      durationMs,
    });

    return {
      ok: false,
      signal: {
        provenance,
        source,
        operation,
        signalKey,
        runId,
        failureCategory: classification.failureCategory,
        telemetry,
        correlationId,
        idempotencyKey,
        metadata,
        occurredAt: new Date().toISOString(),
      },
    };
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    const durationMs = Math.round(performance.now() - start);

    const isAbort = error instanceof Error && error.name === "AbortError";
    const errorName = error instanceof Error ? error.name : "UnknownError";
    const errorMessage = error instanceof Error ? error.message : String(error);

    const classification = classifyHttpFailure({
      status: null,
      durationMs,
      timedOut: isAbort,
      networkError: !isAbort,
      errorName,
      errorMessage,
    });

    const telemetry: SanitizedTelemetry = {
      method,
      url: sanitizedUrl,
      status: null,
      durationMs,
      errorName,
      errorMessage,
      requestHeaders: sanitizedRequestHeaders,
    };

    return {
      ok: false,
      signal: {
        provenance,
        source,
        operation,
        signalKey,
        runId,
        failureCategory: classification.failureCategory,
        telemetry,
        correlationId,
        idempotencyKey,
        metadata,
        occurredAt: new Date().toISOString(),
      },
    };
  }
}
