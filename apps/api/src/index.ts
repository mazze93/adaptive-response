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
 * POST /mcp
 *   → Stateless MCP endpoint (Streamable HTTP) exposing the `adaptive_respond`
 *     tool — same engine, same contract (ADR 0003). Handled by
 *     `createMcpHandler` from the Agents SDK; see ./mcp.ts.
 *
 * GET  /health
 *   → { status: "ok" }
 *
 * Secrets required (set via `wrangler secret put`):
 *   ANTHROPIC_API_KEY
 *
 * Optional secrets:
 *   API_KEYS          — comma-separated Bearer keys for /v1/respond and /mcp
 *                       (ADR 0004). Unset/empty = open access (dev/demo).
 *
 * Env vars (set in wrangler.toml [vars]):
 *   ANTHROPIC_MODEL   — defaults to "claude-sonnet-4-6"
 *   ALLOWED_ORIGINS   — comma-separated CORS origins; empty = deny all cross-origin
 *
 * Bindings (set in wrangler.toml):
 *   RATE_LIMITER      — Workers Rate Limiting binding
 */

import { generateAdaptiveResponse } from "@adaptive/core";
import { createMcpHandler } from "agents/mcp/server";
import { createAdaptiveMcpServer } from "./mcp";

// ─── Env binding ─────────────────────────────────────────────────────────────

interface RateLimiter {
  limit(opts: { key: string }): Promise<{ success: boolean }>;
}

interface Env {
  ANTHROPIC_API_KEY: string;
  ANTHROPIC_MODEL: string;
  ALLOWED_ORIGINS: string;
  RATE_LIMITER: RateLimiter;
  /** Optional Wrangler secret — comma-separated API keys. Unset = open access. */
  API_KEYS?: string;
}

// ─── Bearer-key auth (ADR 0004) ─────────────────────────────────────────────

/** Constant-time byte comparison — no early exit on mismatch. */
function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diff === 0;
}

/**
 * Checks the request's Bearer token against the comma-separated API_KEYS
 * secret. An unset/empty secret disables auth (dev/demo parity — ADR 0004).
 *
 * Keys are compared as SHA-256 digests: it equalises lengths (a requirement
 * of the constant-time loop) and keeps the comparison timing independent of
 * where a mismatch occurs in the raw key material.
 */
async function isAuthorized(request: Request, apiKeys: string | undefined): Promise<boolean> {
  const keys = (apiKeys ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
  if (keys.length === 0) return true; // auth disabled

  const header = request.headers.get("Authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match?.[1]) return false;

  const encoder = new TextEncoder();
  const presented = new Uint8Array(
    await crypto.subtle.digest("SHA-256", encoder.encode(match[1].trim())),
  );

  // Check every key (no early exit) so timing does not reveal which key
  // position, if any, matched.
  let authorized = false;
  for (const key of keys) {
    const expected = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(key)));
    authorized = timingSafeEqualBytes(presented, expected) || authorized;
  }
  return authorized;
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

/** 401 with the RFC 6750 challenge header, inside the standard envelope. */
function unauthorizedResponse(cors: Record<string, string>, requestId: string): Response {
  return new Response(JSON.stringify({ error: "Unauthorized", requestId }), {
    status: 401,
    headers: {
      ...cors,
      ...SECURITY_HEADERS,
      "Content-Type": "application/json",
      "WWW-Authenticate": 'Bearer realm="adaptive-api"',
      "X-Request-ID": requestId,
    },
  });
}

// ─── Worker entry point ────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
    const requestId = crypto.randomUUID();
    const cors = buildCorsHeaders(request, env.ALLOWED_ORIGINS ?? "");
    const url = new URL(request.url);

    // MCP transport — the handler owns its own envelope (CORS, preflight,
    // Origin validation), so it is dispatched before the REST plumbing below.
    // Auth (ADR 0004) and rate limiting are applied first, keyed the same way
    // as /v1/respond, since tool calls reach the same Anthropic-backed engine.
    if (url.pathname === "/mcp") {
      // OPTIONS is exempt: browsers never attach Authorization to preflights.
      if (request.method !== "OPTIONS" && !(await isAuthorized(request, env.API_KEYS))) {
        return unauthorizedResponse(cors, requestId);
      }

      const mcpClientIp = request.headers.get("CF-Connecting-IP") ?? crypto.randomUUID();
      if (env.RATE_LIMITER && request.method === "POST") {
        const { success } = await env.RATE_LIMITER.limit({ key: mcpClientIp });
        if (!success) {
          return jsonResponse(
            { error: "Rate limit exceeded. Please slow down.", requestId },
            429,
            cors,
            requestId,
          );
        }
      }

      // One handler per request is the documented stateless lifecycle (we use
      // no MCP notifications or listen streams, which are the only features
      // that need a module-scope handler).
      const handler = createMcpHandler(() => createAdaptiveMcpServer(env), {
        route: "/mcp",
        // Browser CORS headers are omitted entirely — MCP clients are
        // non-browser; this matches the API's deny-by-default posture. The
        // handler still validates any Origin that is present.
        corsOptions: false,
        onerror: (error) => console.error("[mcp] handler_error", requestId, String(error)),
      });
      // Tests invoke `worker.fetch(request, env)` without a runtime context;
      // the handler only uses `waitUntil`, so a no-op shim is safe there. The
      // real Workers runtime always supplies `ctx`.
      const executionCtx =
        ctx ?? ({ waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext);
      return handler(request, env, executionCtx);
    }

    // Pre-flight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: { ...cors, ...SECURITY_HEADERS, "X-Request-ID": requestId },
      });
    }

    // Health check
    if (request.method === "GET" && url.pathname === "/health") {
      return jsonResponse({ status: "ok" }, 200, cors, requestId);
    }

    // Route guard
    if (request.method !== "POST" || url.pathname !== "/v1/respond") {
      return jsonResponse({ error: "Not found" }, 404, cors, requestId);
    }

    // Auth — checked before rate limiting and the Anthropic call (ADR 0004).
    // An unset API_KEYS secret leaves the endpoint open (dev/demo parity).
    if (!(await isAuthorized(request, env.API_KEYS))) {
      return unauthorizedResponse(cors, requestId);
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
