/**
 * @adaptive/core
 * Runtime-agnostic engine that turns a query into a validated AdaptiveResponse.
 *
 * Structured output is enforced with Anthropic tool-use: the model is forced to
 * call `emit_adaptive_response`, whose input_schema is generated from the Zod
 * schema in @adaptive/schema — the shape can never drift from the contract.
 * If the tool input fails Zod validation, exactly one repair pass feeds the
 * issues back as an error tool_result before giving up. (ADRs 0001 & 0002.)
 *
 * Depends only on web-standard APIs (fetch, setTimeout) — runs unchanged in
 * Workers, Node ≥ 20, and Bun. Never reads env; the caller supplies config.
 */

import type { AdaptiveResponse } from "@adaptive/schema";
import {
  SCHEMA_VERSION,
  safeValidateAdaptiveResponse,
  toAdaptiveResponseJsonSchema,
} from "@adaptive/schema";

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
  /** Injected fetch implementation; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

function backoffDelay(attempt: number, base: number, max: number, random: () => number): number {
  const cap = Math.min(base * 2 ** attempt, max);
  // Full jitter: a random point in [0, cap]. Spreads retries out and avoids
  // thundering-herd synchronisation across concurrent clients.
  return Math.round(random() * cap);
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
  // Resolved at call time so test stubs of globalThis.fetch are honoured.
  const doFetch = opts.fetchImpl ?? fetch;

  for (let attempt = 0; ; attempt++) {
    try {
      const res = await doFetch(input, init);
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

// ─── Structured-output tool ───────────────────────────────────────────────────

export const ADAPTIVE_RESPONSE_TOOL_NAME = "emit_adaptive_response";

/** Minimal recursive JSON-Schema shape — just enough for typed traversal. */
interface JsonSchemaNode {
  [key: string]: unknown;
  properties?: Record<string, JsonSchemaNode>;
}

export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

/**
 * The forced tool the model must call. Its input_schema is generated from the
 * canonical Zod schema, minus the engine-injected fields the model must not
 * set: `meta.tokens_estimated` (real usage comes from the API's usage data)
 * and `meta.schema_version` (stamped from @adaptive/schema's SCHEMA_VERSION).
 */
export function buildAdaptiveResponseTool(): AnthropicTool {
  const schema = toAdaptiveResponseJsonSchema() as JsonSchemaNode;
  delete schema.$schema; // meta-schema URI is noise inside a tool definition
  const meta = schema.properties?.meta;
  if (meta?.properties) {
    delete meta.properties.tokens_estimated;
    delete meta.properties.schema_version;
  }
  return {
    name: ADAPTIVE_RESPONSE_TOOL_NAME,
    description:
      "Emit the complete adaptive response: the mode decision (answer / clarify / hybrid) " +
      "with confidence and risk metadata, clarifying questions when required, the answer, " +
      "and intent metadata.",
    input_schema: schema,
  };
}

// ─── Policy prompt ────────────────────────────────────────────────────────────
//
// Shape lives in the tool schema (generated from Zod); this prompt carries only
// the decision policy. If the *semantics* of the contract change, update both
// this and @adaptive/schema (see CLAUDE.md invariant #3).

const SYSTEM_PROMPT = `\
You are an adaptive response engine. Analyse the user's query, then call the \
${ADAPTIVE_RESPONSE_TOOL_NAME} tool exactly once with your full response.

Decision policy:
- mode "clarify" when confidence < 0.6 OR ambiguity_level is "high".
- mode "answer" when confidence >= 0.7 AND ambiguity_level is "low" or "medium".
- mode "hybrid" otherwise.
- clarifying_questions must be a non-empty array when mode is "clarify" or "hybrid".
- answer.tldr is always present: 1-2 sentences.`;

// ─── Anthropic API surface (minimal) ─────────────────────────────────────────

type ContentBlockParam =
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; tool_use_id: string; is_error: boolean; content: string };

interface MessageParam {
  role: "user" | "assistant";
  content: string | ContentBlockParam[];
}

interface AnthropicEnvelope {
  content: Array<{ type: string; id?: string; name?: string; input?: unknown }>;
  usage?: { input_tokens: number; output_tokens: number };
}

// ─── Engine types ─────────────────────────────────────────────────────────────

export interface EngineInput {
  /** The user's query or prompt. */
  query: string;
  /** Optional context injected before the query. */
  context?: string | undefined;
}

export interface EngineConfig {
  /** Anthropic API key. Supplied by the transport layer — never read from env here. */
  apiKey: string;
  /** Model id. Defaults to "claude-sonnet-4-6". */
  model?: string | undefined;
  /** Anthropic API origin, overridable for tests/proxies. */
  baseUrl?: string | undefined;
  /** max_tokens per model call (default 4096). */
  maxTokens?: number | undefined;
  /** Retry/backoff tuning and injectable fetch/sleep/random. */
  retry?: RetryOptions | undefined;
}

/**
 * Discriminated result — the engine never throws for expected failure modes,
 * so each transport (HTTP Worker, MCP, embedding) maps errors to its own
 * envelope. `detail` fields are for internal logging only; transports must not
 * expose them to callers.
 */
export type EngineResult =
  | { ok: true; response: AdaptiveResponse }
  | { ok: false; code: "upstream_error"; status?: number; detail: string }
  | { ok: false; code: "malformed_response"; detail: string }
  | { ok: false; code: "invalid_model_output"; issues: string[] };

const DEFAULT_MODEL = "claude-sonnet-4-6";
const DEFAULT_BASE_URL = "https://api.anthropic.com";
const DEFAULT_MAX_TOKENS = 4096;
const ANTHROPIC_VERSION = "2023-06-01";

// ─── Single model call ────────────────────────────────────────────────────────

type CallOutcome =
  | { ok: true; toolUse: { id: string; input: unknown }; usageTokens?: number }
  | Extract<EngineResult, { ok: false; code: "upstream_error" | "malformed_response" }>;

async function callAnthropic(
  messages: MessageParam[],
  tool: AnthropicTool,
  config: EngineConfig,
): Promise<CallOutcome> {
  let res: Response;
  try {
    res = await fetchWithRetry(
      `${(config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "")}/v1/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": config.apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model: config.model ?? DEFAULT_MODEL,
          max_tokens: config.maxTokens ?? DEFAULT_MAX_TOKENS,
          system: SYSTEM_PROMPT,
          messages,
          tools: [tool],
          tool_choice: { type: "tool", name: tool.name },
        }),
      },
      config.retry ?? {},
    );
  } catch (e) {
    return { ok: false, code: "upstream_error", detail: String(e) };
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return { ok: false, code: "upstream_error", status: res.status, detail };
  }

  // A 200 with a non-JSON body, missing `content`, or no forced tool_use block
  // is a malformed upstream response — degrade, never throw.
  try {
    const data = (await res.json()) as AnthropicEnvelope;
    if (!Array.isArray(data.content)) {
      return { ok: false, code: "malformed_response", detail: "missing content array" };
    }
    const block = data.content.find(
      (b) => b.type === "tool_use" && b.name === tool.name && typeof b.id === "string",
    );
    if (!block) {
      return {
        ok: false,
        code: "malformed_response",
        detail: `no ${tool.name} tool_use block despite forced tool_choice`,
      };
    }
    const outcome: CallOutcome = {
      ok: true,
      toolUse: { id: block.id as string, input: block.input },
    };
    if (data.usage) {
      outcome.usageTokens = data.usage.input_tokens + data.usage.output_tokens;
    }
    return outcome;
  } catch (e) {
    return { ok: false, code: "malformed_response", detail: String(e) };
  }
}

// ─── Engine ───────────────────────────────────────────────────────────────────

/**
 * Generate a validated AdaptiveResponse for the given input.
 *
 * Makes at most two model calls: the initial forced tool call, plus one repair
 * pass when the tool input fails schema validation (the Zod issues are fed back
 * as an error tool_result). `meta.tokens_estimated` is set to the summed real
 * usage across all calls when the API reports it.
 */
export async function generateAdaptiveResponse(
  input: EngineInput,
  config: EngineConfig,
): Promise<EngineResult> {
  const tool = buildAdaptiveResponseTool();
  const userContent = input.context
    ? `Context:\n${input.context}\n\nQuery:\n${input.query}`
    : input.query;
  const messages: MessageParam[] = [{ role: "user", content: userContent }];

  let totalTokens: number | undefined;
  const maxAttempts = 2; // initial + one repair pass (ADR 0002)

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const call = await callAnthropic(messages, tool, config);
    if (!call.ok) {
      return call;
    }
    if (call.usageTokens !== undefined) {
      totalTokens = (totalTokens ?? 0) + call.usageTokens;
    }

    const validation = safeValidateAdaptiveResponse(call.toolUse.input);
    if (validation.success) {
      if (totalTokens !== undefined) {
        validation.data.meta.tokens_estimated = totalTokens;
      }
      // Stamp the contract version so integrators can detect schema changes
      // without pinning the package (ADR 0004). Engine-owned — overrides
      // anything the model may have emitted.
      validation.data.meta.schema_version = SCHEMA_VERSION;
      return { ok: true, response: validation.data };
    }

    const issues = validation.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    if (attempt === maxAttempts) {
      return { ok: false, code: "invalid_model_output", issues };
    }

    // Repair pass: replay the failed tool call and report the validation
    // issues as an error tool_result, then force the tool again.
    messages.push(
      {
        role: "assistant",
        content: [
          { type: "tool_use", id: call.toolUse.id, name: tool.name, input: call.toolUse.input },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: call.toolUse.id,
            is_error: true,
            content:
              `The tool input failed schema validation:\n- ${issues.join("\n- ")}\n\n` +
              `Call ${tool.name} again with a corrected, complete input.`,
          },
        ],
      },
    );
  }

  // Unreachable: the loop always returns. Satisfies the compiler.
  return { ok: false, code: "invalid_model_output", issues: [] };
}
