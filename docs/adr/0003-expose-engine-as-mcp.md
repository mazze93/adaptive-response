# 0003 — Expose the engine as MCP (remote + stdio)

- **Status:** Proposed (accepted in principle; implementation not started)
- **Date:** 2026-09-16

## Context

The `AdaptiveResponse` contract — decision routing (`answer | clarify | hybrid`),
confidence, ambiguity/risk metadata — is useful to *agents*, not just frontends:
"should I answer or clarify first?" is a triage decision every agent pipeline
faces. MCP is the emerging standard for exposing such capabilities to LLM hosts
(Claude Desktop/Code, Zed, Cursor), and its `outputSchema`/`structuredContent`
support means the typed-JSON value proposition survives when the consumer is an
LLM.

Caveat acknowledged: an MCP tool here is an LLM calling an LLM. The decision
metadata is what justifies it — this is a triage/second-opinion tool, not a
generic "ask Claude" proxy.

ADR 0001 makes this cheap: MCP servers are thin adapters over
`generateAdaptiveResponse`.

## Decision

Add MCP as a **transport**, in two forms:

1. **Remote MCP on the existing Worker** — a `/mcp` endpoint (Streamable HTTP)
   via the Cloudflare Agents SDK (`McpAgent`). Same deploy, same
   `ANTHROPIC_API_KEY` secret, zero new infrastructure.
2. **`@adaptive/mcp` npm package** — a stdio server (`npx @adaptive/mcp`) that
   either proxies a deployed API or, when `ANTHROPIC_API_KEY` is set, runs
   `@adaptive/core` locally.

Tool design:

- Single tool `adaptive_respond`; input `{ query, context? }`.
- `outputSchema` = `toAdaptiveResponseJsonSchema()` from `@adaptive/schema`
  (same artefact as the Anthropic tool schema — one contract, three transports).
- Returns `structuredContent` (the full `AdaptiveResponse`) plus a text fallback
  (tldr + clarifying questions) for hosts without structured-content support.
- The clarify loop is driven through `context`: callers pass answers to prior
  clarifying questions in a follow-up call.

## Alternatives considered

- **MCP-only rewrite** (drop the HTTP API/SDK). Rejected: web frontends are
  first-class consumers; MCP complements, not replaces.
- **Standalone MCP service with its own engine.** Rejected: duplicates the
  engine; ADR 0001 exists precisely to avoid this.

## Consequences

- Any MCP host can consume the engine with zero integration code.
- The Worker gains a Durable Objects dependency (required by `McpAgent`) —
  config change in `wrangler.toml`.
- Remote MCP makes API-key auth (ADR 0004) more urgent.
