/**
 * @adaptive/api — MCP transport tests
 *
 * Exercises the /mcp endpoint end-to-end through `worker.fetch` with a
 * stubbed global fetch (no real Anthropic calls), plus unit tests for the
 * fallback/error text builders. JSON-RPC requests are sent the way a
 * Streamable HTTP client would send them; responses may arrive as plain JSON
 * or as an SSE stream, so the reader below handles both.
 */

import { ADAPTIVE_RESPONSE_TOOL_NAME } from "@adaptive/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "./index.js";
import { buildTextFallback, engineErrorText, RESPOND_TOOL_NAME } from "./mcp.js";

// ─── Test env (mirrors index.test.ts) ────────────────────────────────────────

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

/** A minimal AdaptiveResponse the schema accepts (answer mode). */
function validModelResponse() {
  return {
    decision: { mode: "answer", confidence: 0.9, ambiguity_level: "low", risk_level: "low" },
    answer: { tldr: "A direct answer." },
    meta: { intent_type: "informational", complexity_score: 3 },
  };
}

/** Anthropic 200 envelope carrying a forced tool_use block (engine upstream). */
function anthropicEnvelope(input: unknown): Response {
  return new Response(
    JSON.stringify({
      content: [{ type: "tool_use", id: "toolu_01", name: ADAPTIVE_RESPONSE_TOOL_NAME, input }],
      usage: { input_tokens: 10, output_tokens: 20 },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

/** Stub global fetch (the engine's Anthropic call). */
function stubAnthropic(response: Response): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => response.clone()),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── JSON-RPC plumbing ───────────────────────────────────────────────────────

function rpcRequest(body: unknown, bearer?: string): Request {
  return new Request("https://api.test/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id?: number;
  result?: Record<string, never> & {
    tools?: Array<{ name: string; outputSchema?: Record<string, unknown> }>;
    content?: Array<{ type: string; text?: string }>;
    structuredContent?: Record<string, unknown>;
    isError?: boolean;
    serverInfo?: { name: string; version: string };
  };
  error?: { code: number; message: string };
}

/**
 * Reads a JSON-RPC response body that may be plain JSON or an SSE stream
 * (Streamable HTTP shapes responses by Accept header / handler mode). For SSE,
 * the last `data:` frame carries the final response.
 */
async function readRpc(res: Response): Promise<JsonRpcResponse> {
  const contentType = res.headers.get("Content-Type") ?? "";
  const text = await res.text();
  if (contentType.includes("text/event-stream")) {
    const frames = text
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .filter((data) => data.length > 0);
    const last = frames[frames.length - 1];
    if (last === undefined) throw new Error(`SSE stream had no data frames:\n${text}`);
    return JSON.parse(last) as JsonRpcResponse;
  }
  return JSON.parse(text) as JsonRpcResponse;
}

async function callTool(env: Env, args: Record<string, unknown>): Promise<JsonRpcResponse> {
  const res = await worker.fetch(
    rpcRequest({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: RESPOND_TOOL_NAME, arguments: args },
    }),
    env,
  );
  expect(res.status).toBe(200);
  return readRpc(res);
}

// ─── Protocol surface ────────────────────────────────────────────────────────

describe("POST /mcp protocol surface", () => {
  it("answers initialize with the server identity", async () => {
    const res = await worker.fetch(
      rpcRequest({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "test-client", version: "0.0.0" },
        },
      }),
      makeEnv(),
    );

    expect(res.status).toBe(200);
    const rpc = await readRpc(res);
    expect(rpc.result?.serverInfo?.name).toBe("adaptive-response");
  });

  it("lists adaptive_respond with the canonical outputSchema", async () => {
    const res = await worker.fetch(
      rpcRequest({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }),
      makeEnv(),
    );

    expect(res.status).toBe(200);
    const rpc = await readRpc(res);
    const tool = rpc.result?.tools?.find((t) => t.name === RESPOND_TOOL_NAME);
    expect(tool).toBeDefined();
    // The advertised outputSchema is the same contract the engine enforces:
    // strict object with the clarify/hybrid conditional encoded as allOf.
    expect(tool?.outputSchema?.additionalProperties).toBe(false);
    expect(tool?.outputSchema?.required).toEqual(
      expect.arrayContaining(["decision", "answer", "meta"]),
    );
    expect(Array.isArray(tool?.outputSchema?.allOf)).toBe(true);
  });

  it("404s non-/mcp paths untouched (worker routing preserved)", async () => {
    const res = await worker.fetch(new Request("https://api.test/nope"), makeEnv());
    expect(res.status).toBe(404);
  });
});

// ─── Tool behaviour ──────────────────────────────────────────────────────────

describe("adaptive_respond tool", () => {
  it("returns structuredContent plus a text fallback on success", async () => {
    stubAnthropic(anthropicEnvelope(validModelResponse()));

    const rpc = await callTool(makeEnv(), { query: "What is a Durable Object?" });

    expect(rpc.error).toBeUndefined();
    expect(rpc.result?.isError).toBeFalsy();
    expect(rpc.result?.structuredContent?.decision).toMatchObject({ mode: "answer" });
    const text = rpc.result?.content?.find((c) => c.type === "text")?.text ?? "";
    expect(text).toContain("A direct answer.");
    expect(text).toContain("mode: answer");
  });

  it("surfaces clarifying questions in the text fallback", async () => {
    stubAnthropic(
      anthropicEnvelope({
        decision: { mode: "clarify", confidence: 0.4, ambiguity_level: "high", risk_level: "low" },
        clarifying_questions: ["Which platform?"],
        answer: { tldr: "Need more information first." },
        meta: { intent_type: "informational", complexity_score: 2 },
      }),
    );

    const rpc = await callTool(makeEnv(), { query: "make it faster" });

    const text = rpc.result?.content?.find((c) => c.type === "text")?.text ?? "";
    expect(text).toContain("To clarify:");
    expect(text).toContain("Which platform?");
    expect(rpc.result?.structuredContent?.clarifying_questions).toEqual(["Which platform?"]);
  });

  it("returns an isError tool result when the engine fails upstream", async () => {
    stubAnthropic(new Response("bad gateway", { status: 500 }));

    const rpc = await callTool(makeEnv(), { query: "hi" });

    expect(rpc.result?.isError).toBe(true);
    const text = rpc.result?.content?.find((c) => c.type === "text")?.text ?? "";
    expect(text).toMatch(/upstream error/i);
    // Internal upstream detail must not leak into the tool result.
    expect(text).not.toContain("bad gateway");
  });

  it("rejects an over-limit query at the tool input boundary", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const rpc = await callTool(makeEnv(), { query: "a".repeat(8_001) });

    // Input validation fails before the engine runs — no Anthropic call.
    expect(fetchSpy).not.toHaveBeenCalled();
    const errored = rpc.error !== undefined || rpc.result?.isError === true;
    expect(errored).toBe(true);
  });
});

// ─── Transport hardening ─────────────────────────────────────────────────────

describe("/mcp hardening", () => {
  it("applies the shared rate limiter before dispatching to the MCP handler", async () => {
    const env = makeEnv({ RATE_LIMITER: { limit: async () => ({ success: false }) } });

    const res = await worker.fetch(
      rpcRequest({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
      env,
    );

    expect(res.status).toBe(429);
  });

  it("degrades gracefully when no limiter binding is present", async () => {
    const env = makeEnv();
    (env as { RATE_LIMITER?: unknown }).RATE_LIMITER = undefined;

    const res = await worker.fetch(
      rpcRequest({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }),
      env,
    );

    expect(res.status).toBe(200);
  });

  it("401s /mcp when API_KEYS is set and no Bearer key is presented (ADR 0004)", async () => {
    const res = await worker.fetch(
      rpcRequest({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
      makeEnv({ API_KEYS: "k1" }),
    );

    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toContain("Bearer");
  });

  it("serves /mcp normally with a valid Bearer key", async () => {
    const res = await worker.fetch(
      rpcRequest({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }, "k1"),
      makeEnv({ API_KEYS: "k1" }),
    );

    expect(res.status).toBe(200);
    const rpc = await readRpc(res);
    expect(rpc.result?.tools?.some((t) => t.name === RESPOND_TOOL_NAME)).toBe(true);
  });
});

// ─── Unit: fallback + error text ─────────────────────────────────────────────

describe("buildTextFallback", () => {
  it("renders tldr, clarifying questions, and the decision strip", () => {
    const text = buildTextFallback({
      decision: { mode: "hybrid", confidence: 0.65, ambiguity_level: "medium", risk_level: "low" },
      clarifying_questions: ["Which region?", "What budget?"],
      answer: { tldr: "Probably X, depending on region." },
      meta: { intent_type: "analytical", complexity_score: 5 },
    });

    expect(text).toContain("Probably X, depending on region.");
    expect(text).toContain("- Which region?");
    expect(text).toContain("- What budget?");
    expect(text).toContain("[mode: hybrid · confidence: 0.65 · ambiguity: medium · risk: low]");
  });

  it("omits the clarify block in answer mode", () => {
    const text = buildTextFallback({
      decision: { mode: "answer", confidence: 0.9, ambiguity_level: "low", risk_level: "low" },
      answer: { tldr: "Just X." },
      meta: { intent_type: "informational", complexity_score: 1 },
    });

    expect(text).not.toContain("To clarify:");
  });
});

describe("engineErrorText", () => {
  it("exposes schema issues but keeps upstream detail generic", () => {
    expect(
      engineErrorText({ ok: false, code: "invalid_model_output", issues: ["answer.tldr: bad"] }),
    ).toContain("answer.tldr: bad");
    expect(
      engineErrorText({ ok: false, code: "upstream_error", status: 500, detail: "secret" }),
    ).not.toContain("secret");
  });
});
