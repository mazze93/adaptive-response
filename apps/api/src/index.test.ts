/**
 * @adaptive/api — Worker tests
 *
 * We call `worker.fetch(request, env)` directly with a hand-built env, so we
 * can inject a fake RATE_LIMITER and stub global fetch (no real Anthropic
 * calls). The Worker's surface is web-standard, so plain Node/vitest suffices.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "./index.js";

// ─── Test env ─────────────────────────────────────────────────────────────

interface RateLimiter {
  limit(opts: { key: string }): Promise<{ success: boolean }>;
}

interface Env {
  ANTHROPIC_API_KEY: string;
  ANTHROPIC_MODEL: string;
  ALLOWED_ORIGINS: string;
  RATE_LIMITER: RateLimiter;
}

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    ANTHROPIC_API_KEY: "test-key",
    ANTHROPIC_MODEL: "claude-sonnet-4-6",
    ALLOWED_ORIGINS: "*",
    RATE_LIMITER: { limit: async () => ({ success: true }) },
    ...overrides,
  };
}

function postRespond(body: unknown, origin?: string): Request {
  return new Request("https://api.test/v1/respond", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(origin ? { Origin: origin } : {}),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

/** Stub global fetch (the Anthropic call) to return `response`. */
function stubAnthropic(response: Response | (() => Response | Promise<Response>)): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => (typeof response === "function" ? response() : response)),
  );
}

/** Read a response body with the loose shape our assertions touch. */
async function readBody(res: Response): Promise<{
  error?: string;
  decision?: { mode?: string };
  meta?: { tokens_estimated?: number };
}> {
  return (await res.json()) as never;
}

/** A minimal AdaptiveResponse the schema accepts (answer mode). */
function validModelResponse() {
  return {
    decision: { mode: "answer", confidence: 0.9, ambiguity_level: "low", risk_level: "low" },
    answer: { tldr: "A direct answer." },
    meta: { intent_type: "informational", complexity_score: 3 },
  };
}

/** Wrap model text in an Anthropic 200 messages envelope. */
function anthropicEnvelope(
  text: string,
  usage?: { input_tokens: number; output_tokens: number },
): Response {
  return new Response(
    JSON.stringify({ content: [{ type: "text", text }], ...(usage ? { usage } : {}) }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── GET /health ──────────────────────────────────────────────────────────

describe("GET /health", () => {
  it('returns 200 with { status: "ok" }', async () => {
    const res = await worker.fetch(new Request("https://api.test/health"), makeEnv());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });
});

// ─── Anthropic 200-path resilience (the deliberate core) ────────────────────
//
// These exercise malformed *successful* Anthropic responses. The fetch call
// is wrapped in try/catch, but response *parsing* (`.json()`, `.content`) was
// not — a 200 with a non-JSON body or a missing `content` array threw
// unhandled, escaping the CORS/requestId envelope. Both must degrade to 502.

describe("Anthropic 200 with malformed payload", () => {
  it("maps a non-JSON 200 body to a 502 (not an unhandled throw)", async () => {
    stubAnthropic(new Response("<html>gateway</html>", { status: 200 }));

    const res = await worker.fetch(postRespond({ query: "hi" }), makeEnv());

    expect(res.status).toBe(502);
    expect(res.headers.get("X-Request-ID")).toBeTruthy();
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/anthropic/i);
  });

  it("maps a 200 JSON lacking a `content` array to a 502", async () => {
    stubAnthropic(
      new Response(JSON.stringify({ usage: { input_tokens: 1, output_tokens: 1 } }), {
        status: 200,
      }),
    );

    const res = await worker.fetch(postRespond({ query: "hi" }), makeEnv());

    expect(res.status).toBe(502);
    expect(res.headers.get("X-Request-ID")).toBeTruthy();
  });
});

// ─── Routing & method guards ────────────────────────────────────────────────

describe("routing", () => {
  it("answers an OPTIONS preflight with 204 + CORS + X-Request-ID", async () => {
    const req = new Request("https://api.test/v1/respond", {
      method: "OPTIONS",
      headers: { Origin: "https://app.example" },
    });
    const res = await worker.fetch(req, makeEnv({ ALLOWED_ORIGINS: "https://app.example" }));

    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://app.example");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
    expect(res.headers.get("X-Request-ID")).toBeTruthy();
  });

  it("returns 404 for an unknown path", async () => {
    const res = await worker.fetch(new Request("https://api.test/nope"), makeEnv());
    expect(res.status).toBe(404);
  });

  it("returns 404 for GET on /v1/respond (wrong method)", async () => {
    const res = await worker.fetch(new Request("https://api.test/v1/respond"), makeEnv());
    expect(res.status).toBe(404);
  });
});

// ─── CORS ───────────────────────────────────────────────────────────────────

describe("CORS", () => {
  it("echoes an allow-listed origin", async () => {
    const res = await worker.fetch(
      new Request("https://api.test/health", { headers: { Origin: "https://app.example" } }),
      makeEnv({ ALLOWED_ORIGINS: "https://app.example, https://other.example" }),
    );
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://app.example");
  });

  it("omits Access-Control-Allow-Origin for a disallowed origin (other CORS headers stay)", async () => {
    const res = await worker.fetch(
      new Request("https://api.test/health", { headers: { Origin: "https://evil.example" } }),
      makeEnv({ ALLOWED_ORIGINS: "https://app.example" }),
    );
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
    // The denied response still carries the non-origin CORS headers.
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
  });

  it('echoes * in open mode (ALLOWED_ORIGINS="*")', async () => {
    const res = await worker.fetch(
      new Request("https://api.test/health", { headers: { Origin: "https://anything.example" } }),
      makeEnv({ ALLOWED_ORIGINS: "*" }),
    );
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});

// ─── Rate limiting ──────────────────────────────────────────────────────────

describe("rate limiting", () => {
  it("returns 429 when the limiter denies the request", async () => {
    const env = makeEnv({ RATE_LIMITER: { limit: async () => ({ success: false }) } });
    const res = await worker.fetch(postRespond({ query: "hi" }), env);

    expect(res.status).toBe(429);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/rate limit/i);
  });

  it("degrades gracefully when no limiter binding is present", async () => {
    stubAnthropic(anthropicEnvelope(JSON.stringify(validModelResponse())));
    // RATE_LIMITER intentionally absent.
    const env = makeEnv();
    (env as { RATE_LIMITER?: unknown }).RATE_LIMITER = undefined;

    const res = await worker.fetch(postRespond({ query: "hi" }), env);

    expect(res.status).toBe(200);
  });
});

// ─── Body validation (400s — returned before any Anthropic call) ────────────

describe("body validation", () => {
  it("400 on non-JSON body", async () => {
    const res = await worker.fetch(postRespond("not json {"), makeEnv());
    expect(res.status).toBe(400);
    expect((await readBody(res)).error).toMatch(/json/i);
  });

  it("400 when query is missing", async () => {
    const res = await worker.fetch(postRespond({ context: "x" }), makeEnv());
    expect(res.status).toBe(400);
  });

  it("400 when query is empty / whitespace", async () => {
    const res = await worker.fetch(postRespond({ query: "   " }), makeEnv());
    expect(res.status).toBe(400);
  });

  it("400 when query exceeds 8000 chars", async () => {
    const res = await worker.fetch(postRespond({ query: "a".repeat(8001) }), makeEnv());
    expect(res.status).toBe(400);
    expect((await readBody(res)).error).toMatch(/8[ _]?000/);
  });

  it("400 when context exceeds 8000 chars", async () => {
    const res = await worker.fetch(
      postRespond({ query: "hi", context: "a".repeat(8001) }),
      makeEnv(),
    );
    expect(res.status).toBe(400);
  });
});

// ─── Anthropic glue (happy path, fence-stripping, error mappings) ───────────

describe("Anthropic glue", () => {
  it("returns 200 with the validated response and injects tokens_estimated from usage", async () => {
    stubAnthropic(
      anthropicEnvelope(JSON.stringify(validModelResponse()), {
        input_tokens: 10,
        output_tokens: 20,
      }),
    );

    const res = await worker.fetch(postRespond({ query: "hi" }), makeEnv());

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      decision: { mode: string };
      meta: { tokens_estimated?: number };
    };
    expect(body.decision.mode).toBe("answer");
    expect(body.meta.tokens_estimated).toBe(30);
  });

  it("strips markdown fences the model wraps around the JSON", async () => {
    const fenced = `\`\`\`json\n${JSON.stringify(validModelResponse())}\n\`\`\``;
    stubAnthropic(anthropicEnvelope(fenced));

    const res = await worker.fetch(postRespond({ query: "hi" }), makeEnv());

    expect(res.status).toBe(200);
    expect((await readBody(res)).decision?.mode).toBe("answer");
  });

  it("502 when the Anthropic fetch itself throws (network failure)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      }),
    );

    const res = await worker.fetch(postRespond({ query: "hi" }), makeEnv());
    expect(res.status).toBe(502);
    expect((await readBody(res)).error).toMatch(/reach anthropic/i);
  });

  it("502 when Anthropic responds non-2xx", async () => {
    stubAnthropic(new Response("upstream error", { status: 500 }));

    const res = await worker.fetch(postRespond({ query: "hi" }), makeEnv());
    expect(res.status).toBe(502);
    expect((await readBody(res)).error).toMatch(/anthropic api error/i);
  });

  it("502 when the model returns valid-JSON-envelope but non-JSON text content", async () => {
    stubAnthropic(anthropicEnvelope("here is your answer, no JSON here"));

    const res = await worker.fetch(postRespond({ query: "hi" }), makeEnv());
    expect(res.status).toBe(502);
    expect((await readBody(res)).error).toMatch(/non-json/i);
  });

  it("502 when the model returns JSON that fails schema validation", async () => {
    // Missing required `answer.tldr` and `meta` — schema rejects.
    stubAnthropic(anthropicEnvelope(JSON.stringify({ decision: { mode: "answer" } })));

    const res = await worker.fetch(postRespond({ query: "hi" }), makeEnv());
    expect(res.status).toBe(502);
    expect((await readBody(res)).error).toMatch(/schema validation/i);
  });
});
