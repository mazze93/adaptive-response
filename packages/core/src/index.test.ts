/**
 * @adaptive/core — engine tests
 *
 * The Anthropic call is exercised through an injected fetch (RetryOptions.fetchImpl),
 * so no globals are stubbed and no real network is touched.
 *
 * Covers:
 *   - fetchWithRetry: backoff, jitter, retryable vs non-retryable statuses
 *   - buildAdaptiveResponseTool: schema generation invariants
 *   - generateAdaptiveResponse: happy path, repair pass, error mapping
 */

import { describe, expect, it, vi } from "vitest";
import {
  ADAPTIVE_RESPONSE_TOOL_NAME,
  buildAdaptiveResponseTool,
  fetchWithRetry,
  generateAdaptiveResponse,
} from "./index.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const noopSleep = () => Promise.resolve();

/**
 * A `fetch` stub that plays back a scripted sequence of steps. A `Response`
 * is returned; an `Error` is thrown. The final step repeats for any further
 * calls (so `[resp503]` means "always 503").
 */
function scriptedFetch(steps: Array<Response | Error>) {
  let i = 0;
  return vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => {
    const step = steps[Math.min(i, steps.length - 1)];
    i += 1;
    if (step === undefined) throw new Error("scriptedFetch: empty script");
    if (step instanceof Error) throw step;
    // Clone so a repeated final step can be read more than once.
    return step.clone();
  });
}

/** A minimal AdaptiveResponse the schema accepts (answer mode). */
function validModelOutput() {
  return {
    decision: { mode: "answer", confidence: 0.9, ambiguity_level: "low", risk_level: "low" },
    answer: { tldr: "A direct answer." },
    meta: { intent_type: "informational", complexity_score: 3 },
  };
}

/** Wrap a tool input in an Anthropic 200 messages envelope (forced tool_use). */
function toolUseEnvelope(
  input: unknown,
  usage?: { input_tokens: number; output_tokens: number },
  id = "toolu_01",
): Response {
  return new Response(
    JSON.stringify({
      content: [{ type: "tool_use", id, name: ADAPTIVE_RESPONSE_TOOL_NAME, input }],
      ...(usage ? { usage } : {}),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

/** Engine config wired to a scripted fetch with instant, deterministic retries. */
function makeConfig(fetchImpl: typeof fetch) {
  return {
    apiKey: "test-key",
    retry: { fetchImpl, sleep: noopSleep, random: () => 0.5 },
  };
}

/** Parse the JSON body of the nth request the fetch mock received. */
function requestBody(
  fetchMock: ReturnType<typeof scriptedFetch>,
  n: number,
): {
  system: string;
  messages: Array<{ role: string; content: unknown }>;
  tools: Array<{ name: string; input_schema: Record<string, unknown> }>;
  tool_choice: { type: string; name: string };
} {
  const init = fetchMock.mock.calls[n]?.[1] as RequestInit;
  return JSON.parse(init.body as string);
}

// ─── fetchWithRetry (exponential backoff + full jitter) ─────────────────────

describe("fetchWithRetry", () => {
  it("returns immediately on success without sleeping", async () => {
    const fetchMock = scriptedFetch([new Response("ok", { status: 200 })]);
    const sleeps: number[] = [];

    const res = await fetchWithRetry(
      "https://x",
      { method: "POST" },
      {
        fetchImpl: fetchMock,
        sleep: async (ms) => {
          sleeps.push(ms);
        },
      },
    );

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sleeps).toEqual([]);
  });

  it("retries a retryable status (529) then returns the success", async () => {
    const fetchMock = scriptedFetch([
      new Response("overloaded", { status: 529 }),
      new Response("ok", { status: 200 }),
    ]);

    const res = await fetchWithRetry("https://x", {}, { fetchImpl: fetchMock, sleep: noopSleep });

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries a thrown network error then returns the success", async () => {
    const fetchMock = scriptedFetch([new Error("ECONNRESET"), new Response("ok", { status: 200 })]);

    const res = await fetchWithRetry("https://x", {}, { fetchImpl: fetchMock, sleep: noopSleep });

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after maxRetries and returns the last retryable response", async () => {
    const fetchMock = scriptedFetch([new Response("busy", { status: 503 })]);

    const res = await fetchWithRetry(
      "https://x",
      {},
      { fetchImpl: fetchMock, maxRetries: 2, sleep: noopSleep },
    );

    expect(res.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it("throws after maxRetries on a persistent network error", async () => {
    const fetchMock = scriptedFetch([new Error("ECONNREFUSED")]);

    await expect(
      fetchWithRetry("https://x", {}, { fetchImpl: fetchMock, maxRetries: 2, sleep: noopSleep }),
    ).rejects.toThrow(/ECONNREFUSED/);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does NOT retry a non-retryable 4xx (e.g. 400)", async () => {
    const fetchMock = scriptedFetch([new Response("bad request", { status: 400 })]);
    const sleeps: number[] = [];

    const res = await fetchWithRetry(
      "https://x",
      {},
      {
        fetchImpl: fetchMock,
        sleep: async (ms) => {
          sleeps.push(ms);
        },
      },
    );

    expect(res.status).toBe(400);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sleeps).toEqual([]);
  });

  it("uses exponential backoff with full jitter, capped at maxDelayMs", async () => {
    const fetchMock = scriptedFetch([new Response("busy", { status: 503 })]);
    const sleeps: number[] = [];

    // random() = 1 -> full jitter picks the ceiling of each window.
    await fetchWithRetry(
      "https://x",
      {},
      {
        fetchImpl: fetchMock,
        maxRetries: 3,
        baseDelayMs: 100,
        maxDelayMs: 300,
        random: () => 1,
        sleep: async (ms) => {
          sleeps.push(ms);
        },
      },
    );

    // windows: 100*2^0=100, 100*2^1=200, 100*2^2=400 -> capped to 300
    expect(sleeps).toEqual([100, 200, 300]);
  });

  it("full jitter keeps each delay within [0, window]", async () => {
    const fetchMock = scriptedFetch([new Response("busy", { status: 503 })]);
    const sleeps: number[] = [];

    await fetchWithRetry(
      "https://x",
      {},
      {
        fetchImpl: fetchMock,
        maxRetries: 2,
        baseDelayMs: 100,
        random: () => 0.5, // midpoint of each window
        sleep: async (ms) => {
          sleeps.push(ms);
        },
      },
    );

    expect(sleeps).toEqual([50, 100]); // 0.5*100, 0.5*200
  });
});

// ─── buildAdaptiveResponseTool ───────────────────────────────────────────────

describe("buildAdaptiveResponseTool", () => {
  it("generates a strict object schema from the Zod contract", () => {
    const tool = buildAdaptiveResponseTool();

    expect(tool.name).toBe(ADAPTIVE_RESPONSE_TOOL_NAME);
    expect(tool.input_schema.type).toBe("object");
    expect(tool.input_schema.additionalProperties).toBe(false);
    expect(tool.input_schema.required).toEqual(
      expect.arrayContaining(["decision", "answer", "meta"]),
    );
  });

  it("omits the meta-schema URI and the engine-injected tokens_estimated", () => {
    const tool = buildAdaptiveResponseTool();
    const properties = tool.input_schema.properties as Record<
      string,
      { properties?: Record<string, unknown> }
    >;

    expect(tool.input_schema.$schema).toBeUndefined();
    expect(properties.meta?.properties).toBeDefined();
    expect(properties.meta?.properties?.tokens_estimated).toBeUndefined();
  });

  it("encodes the clarifying_questions invariant as an if/then conditional", () => {
    const tool = buildAdaptiveResponseTool();
    const allOf = tool.input_schema.allOf as Array<{
      if: { properties: { decision: { properties: { mode: { enum: string[] } } } } };
      then: { required: string[] };
    }>;

    expect(allOf).toHaveLength(1);
    expect(allOf[0]?.if.properties.decision.properties.mode.enum).toEqual(["clarify", "hybrid"]);
    expect(allOf[0]?.then.required).toEqual(["clarifying_questions"]);
  });
});

// ─── generateAdaptiveResponse ────────────────────────────────────────────────

describe("generateAdaptiveResponse", () => {
  it("returns a validated response and injects tokens_estimated from usage", async () => {
    const fetchMock = scriptedFetch([
      toolUseEnvelope(validModelOutput(), { input_tokens: 10, output_tokens: 20 }),
    ]);

    const result = await generateAdaptiveResponse({ query: "hi" }, makeConfig(fetchMock));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.response.decision.mode).toBe("answer");
      expect(result.response.meta.tokens_estimated).toBe(30);
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("forces the tool and prepends context to the user message", async () => {
    const fetchMock = scriptedFetch([toolUseEnvelope(validModelOutput())]);

    await generateAdaptiveResponse(
      { query: "which db?", context: "We run on Cloudflare." },
      makeConfig(fetchMock),
    );

    const body = requestBody(fetchMock, 0);
    expect(body.tool_choice).toEqual({ type: "tool", name: ADAPTIVE_RESPONSE_TOOL_NAME });
    expect(body.tools[0]?.name).toBe(ADAPTIVE_RESPONSE_TOOL_NAME);
    expect(body.messages[0]?.content).toBe("Context:\nWe run on Cloudflare.\n\nQuery:\nwhich db?");
    // Shape lives in the tool schema; the prompt carries policy only.
    expect(body.system).toMatch(/decision policy/i);
    expect(body.system).not.toMatch(/interface AdaptiveResponse/);
  });

  it("repairs an invalid tool input by feeding Zod issues back as an error tool_result", async () => {
    const invalid = { decision: { mode: "answer" } }; // missing most required fields
    const fetchMock = scriptedFetch([
      toolUseEnvelope(invalid, { input_tokens: 10, output_tokens: 20 }, "toolu_bad"),
      toolUseEnvelope(validModelOutput(), { input_tokens: 5, output_tokens: 10 }),
    ]);

    const result = await generateAdaptiveResponse({ query: "hi" }, makeConfig(fetchMock));

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    if (result.ok) {
      // usage summed across the initial call and the repair pass
      expect(result.response.meta.tokens_estimated).toBe(45);
    }

    // The repair request replays the failed tool_use and reports the issues.
    const repair = requestBody(fetchMock, 1);
    expect(repair.messages).toHaveLength(3);
    const assistant = repair.messages[1] as {
      role: string;
      content: Array<{ type: string; id: string }>;
    };
    expect(assistant.role).toBe("assistant");
    expect(assistant.content[0]?.type).toBe("tool_use");
    expect(assistant.content[0]?.id).toBe("toolu_bad");
    const toolResult = repair.messages[2] as {
      role: string;
      content: Array<{ type: string; tool_use_id: string; is_error: boolean; content: string }>;
    };
    expect(toolResult.role).toBe("user");
    expect(toolResult.content[0]?.type).toBe("tool_result");
    expect(toolResult.content[0]?.tool_use_id).toBe("toolu_bad");
    expect(toolResult.content[0]?.is_error).toBe(true);
    expect(toolResult.content[0]?.content).toMatch(/failed schema validation/i);
    expect(toolResult.content[0]?.content).toMatch(/answer/); // mentions a failing path
  });

  it("returns invalid_model_output with issues when the repair pass also fails", async () => {
    const fetchMock = scriptedFetch([toolUseEnvelope({ decision: { mode: "answer" } })]);

    const result = await generateAdaptiveResponse({ query: "hi" }, makeConfig(fetchMock));

    expect(fetchMock).toHaveBeenCalledTimes(2); // initial + exactly one repair
    expect(result).toMatchObject({ ok: false, code: "invalid_model_output" });
    if (!result.ok && result.code === "invalid_model_output") {
      expect(result.issues.length).toBeGreaterThan(0);
    }
  });

  it("enforces the clarify invariant: clarify mode without questions is repaired or rejected", async () => {
    const clarifyMissingQuestions = {
      decision: { mode: "clarify", confidence: 0.4, ambiguity_level: "high", risk_level: "low" },
      answer: { tldr: "Need more info." },
      meta: { intent_type: "informational", complexity_score: 2 },
    };
    const fetchMock = scriptedFetch([toolUseEnvelope(clarifyMissingQuestions)]);

    const result = await generateAdaptiveResponse({ query: "hi" }, makeConfig(fetchMock));

    expect(result).toMatchObject({ ok: false, code: "invalid_model_output" });
    if (!result.ok && result.code === "invalid_model_output") {
      expect(result.issues.join("\n")).toMatch(/clarifying_questions/);
    }
  });

  it("maps a persistent non-2xx to upstream_error with the status", async () => {
    const fetchMock = scriptedFetch([new Response("overloaded", { status: 529 })]);

    const result = await generateAdaptiveResponse({ query: "hi" }, makeConfig(fetchMock));

    expect(fetchMock).toHaveBeenCalledTimes(3); // initial + 2 backoff retries
    expect(result).toMatchObject({ ok: false, code: "upstream_error", status: 529 });
  });

  it("maps a persistent network error to upstream_error", async () => {
    const fetchMock = scriptedFetch([new Error("ECONNREFUSED")]);

    const result = await generateAdaptiveResponse({ query: "hi" }, makeConfig(fetchMock));

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result).toMatchObject({ ok: false, code: "upstream_error" });
    if (!result.ok && result.code === "upstream_error") {
      expect(result.detail).toMatch(/ECONNREFUSED/);
    }
  });

  it("maps a non-JSON 200 body to malformed_response", async () => {
    const fetchMock = scriptedFetch([new Response("<html>gateway</html>", { status: 200 })]);

    const result = await generateAdaptiveResponse({ query: "hi" }, makeConfig(fetchMock));

    expect(result).toMatchObject({ ok: false, code: "malformed_response" });
  });

  it("maps a 200 JSON lacking a content array to malformed_response", async () => {
    const fetchMock = scriptedFetch([
      new Response(JSON.stringify({ usage: { input_tokens: 1, output_tokens: 1 } }), {
        status: 200,
      }),
    ]);

    const result = await generateAdaptiveResponse({ query: "hi" }, makeConfig(fetchMock));

    expect(result).toMatchObject({ ok: false, code: "malformed_response" });
  });

  it("maps a 200 without the forced tool_use block to malformed_response", async () => {
    const fetchMock = scriptedFetch([
      new Response(JSON.stringify({ content: [{ type: "text", text: "chatty answer" }] }), {
        status: 200,
      }),
    ]);

    const result = await generateAdaptiveResponse({ query: "hi" }, makeConfig(fetchMock));

    expect(result).toMatchObject({ ok: false, code: "malformed_response" });
  });

  it("recovers when a transient 529 is followed by a valid tool_use response", async () => {
    const fetchMock = scriptedFetch([
      new Response("overloaded", { status: 529 }),
      toolUseEnvelope(validModelOutput()),
    ]);

    const result = await generateAdaptiveResponse({ query: "hi" }, makeConfig(fetchMock));

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("leaves tokens_estimated unset when the API reports no usage", async () => {
    const fetchMock = scriptedFetch([toolUseEnvelope(validModelOutput())]);

    const result = await generateAdaptiveResponse({ query: "hi" }, makeConfig(fetchMock));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.response.meta.tokens_estimated).toBeUndefined();
    }
  });
});
