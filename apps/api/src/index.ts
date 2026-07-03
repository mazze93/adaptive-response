/**
 * Adaptive Response API — Cloudflare Worker
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
 *   ALLOWED_ORIGINS   — comma-separated CORS origins, or "*"
 *
 * Bindings (set in wrangler.toml):
 *   RATE_LIMITER      — Workers Rate Limiting binding
 */

import { safeValidateAdaptiveResponse } from "@adaptive/schema";

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

// ─── Anthropic API types (minimal surface) ───────────────────────────────────

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string;
}

interface AnthropicRequest {
  model: string;
  max_tokens: number;
  system: string;
  messages: AnthropicMessage[];
}

interface AnthropicResponse {
  content: Array<{ type: string; text: string }>;
  usage?: { input_tokens: number; output_tokens: number };
}

// ─── System prompt ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `\
You are an adaptive response engine. Analyse the user's query and respond \
with a single JSON object that strictly matches this TypeScript interface — \
no markdown fences, no prose outside the JSON:

interface AdaptiveResponse {
  decision: {
    mode: "answer" | "clarify" | "hybrid";   // "clarify" when confidence<0.6 OR ambiguity=high; "answer" when confidence≥0.7 AND ambiguity low/medium; "hybrid" otherwise
    confidence: number;                       // 0–1
    ambiguity_level: "low" | "medium" | "high";
    risk_level: "low" | "medium" | "high";
  };
  clarifying_questions?: string[];            // required (non-empty, each item non-empty) when mode is "clarify" or "hybrid"
  answer: {
    tldr: string;                             // always present, 1–2 sentences
    sections?: Array<{ title: string; content: string }>;
    assumptions?: string[];
    alternatives?: Array<{ condition: string; approach: string }>;
    risks?: string[];
  };
  meta: {
    intent_type: "informational" | "analytical" | "generative" | "diagnostic" | "comparative";
    complexity_score: number;                 // 0–10
  };
}`;

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
      "Content-Type": "application/json",
      "X-Request-ID": requestId,
    },
  });
}

// ─── Retry with exponential backoff + full jitter ─────────────────────────────

/** HTTP statuses worth retrying — transient upstream conditions. */
const RETRYABLE_STATUS = new Set([408, 409, 429, 500, 502, 503, 529]);

export interface RetryOptions {
  /** Additional attempts after the first (default 2 → up to 3 total). */
  maxRetries?: number;
  /** Backoff base in ms (default 250). */
  baseDelayMs?: number;
  /** Per-attempt delay ceiling in ms (default 2000). */
  maxDelayMs?: number;
  /** Injected for tests; defaults to a real setTimeout-based sleep. */
  sleep?: (ms: number) => Promise<void>;
  /** Injected for deterministic jitter in tests; defaults to Math.random. */
  random?: () => number;
}

function backoffDelay(attempt: number, base: number, max: number, random: () => number): number {
  const window = Math.min(base * 2 ** attempt, max);
  // Full jitter: a random point in [0, window]. Spreads retries out and avoids
  // thundering-herd synchronisation across concurrent clients.
  return Math.round(random() * window);
}

/**
 * `fetch` with retry on transient failures — network errors and retryable HTTP
 * statuses (see RETRYABLE_STATUS) — using exponential backoff with full jitter.
 *
 * Non-retryable responses (e.g. 4xx) return immediately, as does the response
 * from the final attempt (the caller decides how to handle a lingering error
 * status). A network error that persists through the last attempt is rethrown.
 */
export async function fetchWithRetry(
  input: string,
  init: RequestInit,
  opts: RetryOptions = {},
): Promise<Response> {
  const maxRetries = opts.maxRetries ?? 2;
  const baseDelayMs = opts.baseDelayMs ?? 250;
  const maxDelayMs = opts.maxDelayMs ?? 2000;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const random = opts.random ?? Math.random;

  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(input, init);
      if (RETRYABLE_STATUS.has(res.status) && attempt < maxRetries) {
        await sleep(backoffDelay(attempt, baseDelayMs, maxDelayMs, random));
        continue;
      }
      return res;
    } catch (e) {
      if (attempt < maxRetries) {
        await sleep(backoffDelay(attempt, baseDelayMs, maxDelayMs, random));
        continue;
      }
      throw e;
    }
  }
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
        headers: { ...cors, "X-Request-ID": requestId },
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

    // Rate limiting — keyed on client IP, degrades gracefully if binding absent
    const clientIp = request.headers.get("CF-Connecting-IP") ?? "unknown";
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

    const userContent = context ? `Context:\n${context}\n\nQuery:\n${query}` : query;

    // Call Anthropic
    const anthropicReq: AnthropicRequest = {
      model: env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    };

    let anthropicRes: Response;
    try {
      // Retries transient failures (network errors, 429/5xx/529) with
      // exponential backoff + full jitter before giving up.
      anthropicRes = await fetchWithRetry("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(anthropicReq),
      });
    } catch (e) {
      return jsonResponse(
        { error: "Failed to reach Anthropic API", detail: String(e), requestId },
        502,
        cors,
        requestId,
      );
    }

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text().catch(() => "");
      return jsonResponse(
        { error: "Anthropic API error", detail: errText, requestId },
        502,
        cors,
        requestId,
      );
    }

    // Parse the Anthropic response body. A 200 with a non-JSON body, or valid
    // JSON that lacks the expected `content` array, must degrade to a 502
    // rather than throwing unhandled and escaping the CORS/requestId envelope.
    let rawText: string;
    let anthropicUsage: AnthropicResponse["usage"];
    try {
      const anthropicData = (await anthropicRes.json()) as AnthropicResponse;
      if (!Array.isArray(anthropicData.content)) {
        throw new Error("missing content array");
      }

      // Extract text from first text block
      rawText = anthropicData.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim();

      // Carry usage forward for token estimation below.
      anthropicUsage = anthropicData.usage;
    } catch (e) {
      return jsonResponse(
        { error: "Anthropic API returned a malformed response", detail: String(e), requestId },
        502,
        cors,
        requestId,
      );
    }

    // Strip markdown fences if the model wrapped the JSON despite instructions.
    // Handles: ```json\n{...}\n``` and ```\n{...}\n```
    const jsonText = rawText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();

    // Parse JSON from model output
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      return jsonResponse(
        { error: "Model returned non-JSON content", raw: rawText.slice(0, 500), requestId },
        502,
        cors,
        requestId,
      );
    }

    // Validate against schema
    const validation = safeValidateAdaptiveResponse(parsed);
    if (!validation.success) {
      return jsonResponse(
        {
          error: "Model response failed schema validation",
          issues: validation.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
          requestId,
        },
        502,
        cors,
        requestId,
      );
    }

    // Attach token usage to meta if available
    if (anthropicUsage) {
      validation.data.meta.tokens_estimated =
        anthropicUsage.input_tokens + anthropicUsage.output_tokens;
    }

    return jsonResponse(validation.data, 200, cors, requestId);
  },
};
