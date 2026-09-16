/**
 * @adaptive-response/api — Worker tests
 *
 * We call `worker.fetch(request, env)` directly with a hand-built env, so we
 * can inject a fake RATE_LIMITER and stub global fetch (no real Anthropic
 * calls). The Worker's surface is web-standard, so plain Node/vitest suffices.
 *
 * These are transport-level tests: routing, CORS, rate limiting, body
 * validation, and engine-error → HTTP-status mapping. The engine internals
 * (tool schema, repair-pass mechanics, retry/backoff) are unit-tested in
 * @adaptive-response/core; here we only exercise them end-to-end through the Worker.
 */

import { ADAPTIVE_RESPONSE_TOOL_NAME } from "@adaptive-response/core";
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
  API_KEYS?: string;
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

function postRespond(body: unknown, origin?: string, bearer?: string): Request {
  return new Request("https://api.test/v1/respond", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(origin ? { Origin: origin } : {}),
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

/** Stub global fetch (the Anthropic call) to return `response`. */
function stubAnthropic(response: Response | (() => Response | Promise<Response>)): void {
  vi.stubGlobal(
    "fetch",
    // Static responses are cloned so the stub can serve more than one call
    // (a Response body is single-use).
    vi.fn(async () => (typeof response === "function" ? response() : response.clone())),
  );
}

/** Read a response body with the loose shape our assertions touch. */
async function readBody(res: Response): Promise<{
  error?: string;
  issues?: string[];
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

/**
 * Wrap a tool input in an Anthropic 200 messages envelope. The engine forces
 * tool_choice, so a well-formed upstream response always carries a tool_use
 * block for ADAPTIVE_RESPONSE_TOOL_NAME.
 */
function anthropicEnvelope(
  input: unknown,
  usage?: { input_tokens: number; output_tokens: number },
): Response {
  return new Response(
    JSON.stringify({
      content: [{ type: "tool_use", id: "toolu_01", name: ADAPTIVE_RESPONSE_TOOL_NAME, input }],
      ...(usage ? { usage } : {}),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * A `fetch` stub that plays back a scripted sequence of steps. A `Response`
 * is returned; an `Error` is thrown. The final step repeats for any further
 * calls (so `[resp503]` means "always 503").
 */
function scriptedFetch(steps: Array<Response | Error>) {
  let i = 0;
  const mock = vi.fn(async () => {
    const step = steps[Math.min(i, steps.length - 1)];
    i += 1;
    if (step === undefined) throw new Error("scriptedFetch: empty script");
    if (step instanceof Error) throw step;
    return step.clone();
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}

/**
 * Run `fn` under fake timers, flushing all pending backoff sleeps so
 * retry-heavy paths resolve instantly and deterministically (no real waiting,
 * no jitter flakiness).
 */
async function withAdvancedTimers<T>(fn: () => Promise<T>): Promise<T> {
  vi.useFakeTimers();
  try {
    const p = fn();
    await vi.advanceTimersByTimeAsync(30_000);
    return await p;
  } finally {
    vi.useRealTimers();
  }
}

// ─── GET /health ──────────────────────────────────────────────────────────

describe("GET /health", () => {
  it('returns 200 with { status: "ok" }', async () => {
    const res = await worker.fetch(new Request("https://api.test/health"), makeEnv());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });
});

// ─── Anthropic 200-path resilience ───────────────────────────────────────────
//
// Malformed *successful* Anthropic responses (non-JSON body, missing content
// array, missing tool_use block) must degrade to a 502 inside the
// CORS/requestId envelope — never an unhandled throw.

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

  it("maps a 200 without the forced tool_use block to a 502", async () => {
    stubAnthropic(
      new Response(JSON.stringify({ content: [{ type: "text", text: "chatty answer" }] }), {
        status: 200,
      }),
    );

    const res = await worker.fetch(postRespond({ query: "hi" }), makeEnv());

    expect(res.status).toBe(502);
    expect((await readBody(res)).error).toMatch(/anthropic/i);
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
    stubAnthropic(anthropicEnvelope(validModelResponse()));
    // RATE_LIMITER intentionally absent.
    const env = makeEnv();
    (env as { RATE_LIMITER?: unknown }).RATE_LIMITER = undefined;

    const res = await worker.fetch(postRespond({ query: "hi" }), env);

    expect(res.status).toBe(200);
  });
});

// ─── Bearer-key auth (ADR 0004) ──────────────────────────────────────────────────

describe("bearer-key auth", () => {
  it("is open when API_KEYS is unset (dev/demo parity)", async () => {
    stubAnthropic(anthropicEnvelope(validModelResponse()));
    const res = await worker.fetch(postRespond({ query: "hi" }), makeEnv());
    expect(res.status).toBe(200);
  });

  it("401s a request with no Authorization header when keys are set", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const res = await worker.fetch(postRespond({ query: "hi" }), makeEnv({ API_KEYS: "k1, k2" }));

    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toContain("Bearer");
    expect(res.headers.get("X-Request-ID")).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled(); // rejected before the Anthropic call
  });

  it("401s a wrong key", async () => {
    const res = await worker.fetch(
      postRespond({ query: "hi" }, undefined, "nope"),
      makeEnv({ API_KEYS: "k1,k2" }),
    );
    expect(res.status).toBe(401);
  });

  it("accepts any key from the comma-separated list", async () => {
    stubAnthropic(anthropicEnvelope(validModelResponse()));
    const env = makeEnv({ API_KEYS: "k1, k2" });

    const first = await worker.fetch(postRespond({ query: "hi" }, undefined, "k1"), env);
    const second = await worker.fetch(postRespond({ query: "hi" }, undefined, "k2"), env);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
  });

  it("leaves /health open even when keys are set", async () => {
    const res = await worker.fetch(
      new Request("https://api.test/health"),
      makeEnv({ API_KEYS: "k1" }),
    );
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

// ─── Engine glue (happy path, repair pass, error mappings) ───────────────────

describe("engine glue", () => {
  it("returns 200 with the validated response and injects tokens_estimated from usage", async () => {
    stubAnthropic(
      anthropicEnvelope(validModelResponse(), {
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

  it("recovers via the repair pass when the first tool input fails validation", async () => {
    const fetchMock = scriptedFetch([
      anthropicEnvelope({ decision: { mode: "answer" } }, { input_tokens: 10, output_tokens: 20 }),
      anthropicEnvelope(validModelResponse(), { input_tokens: 5, output_tokens: 10 }),
    ]);

    const res = await worker.fetch(postRespond({ query: "hi" }), makeEnv());

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2); // initial + repair
    const body = await readBody(res);
    expect(body.decision?.mode).toBe("answer");
    // usage summed across both model calls
    expect(body.meta?.tokens_estimated).toBe(45);
  });

  it("502 with issues when the repair pass also fails schema validation", async () => {
    const fetchMock = scriptedFetch([anthropicEnvelope({ decision: { mode: "answer" } })]);

    const res = await worker.fetch(postRespond({ query: "hi" }), makeEnv());

    expect(res.status).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(2); // exactly one repair, then give up
    const body = await readBody(res);
    expect(body.error).toMatch(/schema validation/i);
    expect(body.issues?.length).toBeGreaterThan(0);
  });

  it("retries then 502s when the Anthropic fetch keeps throwing (network failure)", async () => {
    const fetchMock = scriptedFetch([new Error("ECONNREFUSED")]);

    const res = await withAdvancedTimers(() =>
      worker.fetch(postRespond({ query: "hi" }), makeEnv()),
    );

    expect(res.status).toBe(502);
    // Hardened Worker returns a generic "Upstream error" (no internal detail
    // leaked). The retry count below is what distinguishes this path.
    expect((await readBody(res)).error).toMatch(/upstream error/i);
    expect(fetchMock).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it("retries then 502s when Anthropic keeps responding non-2xx (500)", async () => {
    const fetchMock = scriptedFetch([new Response("upstream error", { status: 500 })]);

    const res = await withAdvancedTimers(() =>
      worker.fetch(postRespond({ query: "hi" }), makeEnv()),
    );

    expect(res.status).toBe(502);
    expect((await readBody(res)).error).toMatch(/upstream error/i);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("recovers when a transient 529 is followed by a 200", async () => {
    const fetchMock = scriptedFetch([
      new Response("overloaded", { status: 529 }),
      anthropicEnvelope(validModelResponse()),
    ]);

    const res = await withAdvancedTimers(() =>
      worker.fetch(postRespond({ query: "hi" }), makeEnv()),
    );

    expect(res.status).toBe(200);
    expect((await readBody(res)).decision?.mode).toBe("answer");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
