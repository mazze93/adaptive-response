/**
 * MCP transport for the Adaptive Response engine (ADR 0003).
 *
 * A stateless MCP server (SDK v2 via `createMcpHandler` — no Durable Object,
 * no session state) exposing a single tool, `adaptive_respond`, that calls the
 * same `generateAdaptiveResponse` engine as the HTTP transport.
 *
 * The tool's `outputSchema` is the canonical JSON Schema exported by
 * @adaptive/schema — the same artefact that drives the Anthropic tool
 * definition — so all transports advertise one contract. Hosts that support
 * structured content get the full typed AdaptiveResponse; others get a text
 * fallback (tldr + clarifying questions + decision metadata).
 */

import type { EngineResult } from "@adaptive/core";
import { generateAdaptiveResponse } from "@adaptive/core";
import type { AdaptiveResponse } from "@adaptive/schema";
import { toAdaptiveResponseJsonSchema } from "@adaptive/schema";
import type { JsonSchemaType } from "@modelcontextprotocol/server";
import { fromJsonSchema, McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

export const MCP_SERVER_NAME = "adaptive-response";
export const MCP_SERVER_VERSION = "0.1.0";
export const RESPOND_TOOL_NAME = "adaptive_respond";

/** The slice of the Worker env the MCP server needs. */
export interface McpEnv {
  ANTHROPIC_API_KEY: string;
  ANTHROPIC_MODEL: string;
}

// Mirrors the /v1/respond HTTP limits so both transports enforce the same
// input contract.
const RespondInputSchema = z.object({
  query: z.string().min(1).max(8_000).describe("The question or task to triage and answer."),
  context: z
    .string()
    .max(8_000)
    .optional()
    .describe(
      "Optional background for the query. On a follow-up call, include your answers to the " +
        "clarifying_questions from the previous response here to continue the clarify loop.",
    ),
});

/** Human-readable fallback for MCP hosts without structured-content support. */
export function buildTextFallback(response: AdaptiveResponse): string {
  const { decision, clarifying_questions, answer } = response;
  const lines = [answer.tldr];

  if (clarifying_questions && clarifying_questions.length > 0) {
    lines.push("", "To clarify:");
    for (const q of clarifying_questions) {
      lines.push(`- ${q}`);
    }
  }

  lines.push(
    "",
    `[mode: ${decision.mode} · confidence: ${decision.confidence} · ` +
      `ambiguity: ${decision.ambiguity_level} · risk: ${decision.risk_level}]`,
  );
  return lines.join("\n");
}

/**
 * Maps engine failures to MCP error text. Mirrors the HTTP transport's
 * policy: `detail` fields are logged by the caller, never surfaced;
 * validation issues are safe to expose.
 */
export function engineErrorText(result: Extract<EngineResult, { ok: false }>): string {
  switch (result.code) {
    case "upstream_error":
      return "Upstream error: the Anthropic API request failed. Try again shortly.";
    case "malformed_response":
      return "Anthropic API returned a malformed response. Try again shortly.";
    case "invalid_model_output":
      return `Model response failed schema validation:\n- ${result.issues.join("\n- ")}`;
  }
}

/**
 * SDK v2 server factory — `createMcpHandler` calls this once per request
 * (the documented stateless lifecycle), so closing over `env` here is safe.
 */
export function createAdaptiveMcpServer(env: McpEnv): McpServer {
  const server = new McpServer({
    name: MCP_SERVER_NAME,
    version: MCP_SERVER_VERSION,
  });

  server.registerTool(
    RESPOND_TOOL_NAME,
    {
      title: "Adaptive respond",
      description:
        "Triage a query and produce a schema-validated adaptive response: a decision on whether " +
        "to answer directly, ask clarifying questions, or both (mode: answer | clarify | hybrid), " +
        "with confidence, ambiguity and risk metadata, a tldr, and optional sections, assumptions, " +
        "alternatives, and risks. When mode is clarify or hybrid, answer the clarifying_questions " +
        "and call the tool again with those answers in `context`.",
      inputSchema: RespondInputSchema,
      outputSchema: fromJsonSchema<AdaptiveResponse>(
        toAdaptiveResponseJsonSchema() as JsonSchemaType,
      ),
    },
    async ({ query, context }) => {
      const trimmedContext = context?.trim();
      const result = await generateAdaptiveResponse(
        { query: query.trim(), context: trimmedContext || undefined },
        {
          apiKey: env.ANTHROPIC_API_KEY,
          model: env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
        },
      );

      if (!result.ok) {
        // Internal detail goes to the log stream, never to the client —
        // same hardening posture as the HTTP transport.
        console.error(
          "[mcp] engine_error",
          result.code,
          "detail" in result ? result.detail : result.issues,
        );
        return {
          content: [{ type: "text", text: engineErrorText(result) }],
          isError: true,
        };
      }

      return {
        content: [{ type: "text", text: buildTextFallback(result.response) }],
        structuredContent: result.response,
      };
    },
  );

  return server;
}
