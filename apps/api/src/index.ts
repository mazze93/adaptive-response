/**
 * Adaptive Response API — Cloudflare Worker
 *
 * Thin HTTP transport over @adaptive/core (see ADR 0001): routing, CORS,
 * rate limiting, body validation, and engine-error → HTTP-status mapping.
 * The engine itself — forced tool-use structured output, schema validation,
 * repair pass, retry/backoff — lives in @adaptive/core (ADR 0002).
 *
 * POST /v1/respond  { query: string, context?: string }
 *   → AdaptiveResponse JSON
 *
 * GET  /health
 *   → { status: "ok" }
 *
 * Secrets required (set via `wrangler secret put`):
 *   ANTHROPIC_API_KEY
 *
 * Env vars (set in wrangler.toml [vars]):
 *   ANTHROPIC_MODEL   — defaults to "claude-sonnet-4-6"
 *   ALLOWED_ORIGINS   — comma-separated CORS origins; empty = deny all cross-origin
 *
 * Bindings (set in wrangler.toml):
 *   RATE_LIMITER      — Workers Rate Limiting binding
 */

import { generateAdaptiveResponse } from "@adaptive/core";

// ─── Env binding ─────────────────────────────────────────────────────────────

interface RateLimiter {
  limit(opts: { key: string }): Promise<{ success: boolean }>;
}

interface Env {
  ANTHROPIC_API_KEY: string;
  ANTHROPIC_MODEL: string;
  ALLOWED_ORIGINS: string;
  RATE_LIMITER: RateLimiter;
}

// ─── Hardened response headers ────────────────────────────────────────────────

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
};

// ─── CORS helpers ─────────────────────────────────────────────────────────────

/**
 * Returns CORS headers for the given request.
 * Access-Control-Allow-Origin is omitted entirely when the request origin
 * is not in the allowlist — browsers will block the response without it,
 * which is the correct behaviour for denied origins.
 */
function buildCorsHeaders(request: Request, allowedOrigins: string): Record<string, string> {
  const origin = request.headers.get("Origin") ?? "";
  const allowedOrigin =
    allowedOrigins === "*"
      ? "*"
      : allowedOrigins
            .split(",")
            .map((o) => o.trim())
            .includes(origin)
        ? origin
        : null;

  return {
    ...(allowedOrigin !== null && { "Access-Control-Allow-Origin": allowedOrigin }),
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

// ─── Response helpers ─────────────────────────────────────────────────────────

function jsonResponse(
  body: unknown,
  status: number,
  cors: Record<string, string>,
  requestId: string,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors,
      ...SECURITY_HEADERS,
      "Content-Type": "application/json",
      "X-Request-ID": requestId,
    },
  });
}

// ─── Worker entry point ──────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const requestId = crypto.randomUUID();
    const cors = buildCorsHeaders(request, env.ALLOWED_ORIGINS ?? "");

    // Pre-flight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: { ...cors, ...SECURITY_HEADERS, "X-Request-ID": requestId },
      });
    }

    const url = new URL(request.url);

    // Health check
    if (request.method === "GET" && url.pathname === "/health") {
      return jsonResponse({ status: "ok" }, 200, cors, requestId);
    }

    // Route guard
    if (request.method !== "POST" || url.pathname !== "/v1/respond") {
      return jsonResponse({ error: "Not found" }, 404, cors, requestId);
    }

    // Rate limiting — keyed on client IP, degrades gracefully if binding absent.
    // Falls back to a random UUID so each anonymous request gets its own bucket
    // instead of all sharing a single "unknown" key (which would allow bypass
    // in any environment that doesn't inject CF-Connecting-IP).
    const clientIp = request.headers.get("CF-Connecting-IP") ?? crypto.randomUUID();
    if (env.RATE_LIMITER) {
      const { success } = await env.RATE_LIMITER.limit({ key: clientIp });
      if (!success) {
        return jsonResponse(
          { error: "Rate limit exceeded. Please slow down.", requestId },
          429,
          cors,
          requestId,
        );
      }
    }

    // Parse body
    let body: { query?: unknown; context?: unknown };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return jsonResponse(
        { error: "Request body must be valid JSON", requestId },
        400,
        cors,
        requestId,
      );
    }

    if (typeof body.query !== "string" || body.query.trim() === "") {
      return jsonResponse(
        { error: "`query` must be a non-empty string", requestId },
        400,
        cors,
        requestId,
      );
    }

    const query = body.query.trim();
    const context = typeof body.context === "string" ? body.context.trim() : undefined;

    if (query.length > 8_000) {
      return jsonResponse(
        { error: "`query` must be 8 000 characters or fewer", requestId },
        400,
        cors,
        requestId,
      );
    }
    if (context !== undefined && context.length > 8_000) {
      return jsonResponse(
        { error: "`context` must be 8 000 characters or fewer", requestId },
        400,
        cors,
        requestId,
      );
    }

    // Run the engine. It returns typed results instead of throwing, so every
    // failure mode below stays inside the CORS/requestId envelope.
    const result = await generateAdaptiveResponse(
      { query, context },
      {
        apiKey: env.ANTHROPIC_API_KEY,
        model: env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
      },
    );

    if (!result.ok) {
      switch (result.code) {
        case "upstream_error":
          // Log internally via Cloudflare Logpush/tail — never expose upstream
          // details to callers (they may contain model/policy information).
          console.error("[502] upstream_error", requestId, result.status ?? "", result.detail);
          return jsonResponse({ error: "Upstream error", requestId }, 502, cors, requestId);
        case "malformed_response":
          console.error("[502] malformed_anthropic_response", requestId, result.detail);
          return jsonResponse(
            { error: "Anthropic API returned a malformed response", requestId },
            502,
            cors,
            requestId,
          );
        case "invalid_model_output":
          return jsonResponse(
            {
              error: "Model response failed schema validation",
              issues: result.issues,
              requestId,
            },
            502,
            cors,
            requestId,
          );
      }
    }

    return jsonResponse(result.response, 200, cors, requestId);
  },
};
