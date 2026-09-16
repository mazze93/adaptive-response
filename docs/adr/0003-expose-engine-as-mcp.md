# 0003 — Expose the engine as MCP (remote + stdio)

- **Status:** Accepted — remote endpoint implemented 2026-09-16; stdio package still pending
- **Date:** 2026-09-16

## Context

The `AdaptiveResponse` contract — decision routing (`answer | clarify | hybrid`),
confidence, ambiguity/risk metadata — is useful to *agents*, not just frontends:
"should I answer or clarify first?" is a triage decision every agent pipeline
faces. MCP is the standard for exposing such capabilities to LLM hosts
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
   implemented with **`createMcpHandler`** from the Agents SDK
   (`agents/mcp/server` + MCP SDK v2). Same deploy, same `ANTHROPIC_API_KEY`
   secret, zero new infrastructure. *Implemented* in `apps/api/src/mcp.ts`.
2. **`@adaptive/mcp` npm package** — a stdio server (`npx @adaptive/mcp`) that
   either proxies a deployed API or, when `ANTHROPIC_API_KEY` is set, runs
   `@adaptive/core` locally. *Pending.*

Tool design (implemented):

- Single tool `adaptive_respond`; input `{ query, context? }` with the same
  8 000-char limits as `/v1/respond`.
- `outputSchema` = `toAdaptiveResponseJsonSchema()` from `@adaptive/schema` via
  the SDK's `fromJsonSchema` — the same artefact that drives the Anthropic tool
  definition. One contract, every transport.
- Returns `structuredContent` (the full `AdaptiveResponse`) plus a text
  fallback (tldr + clarifying questions + decision strip) for hosts without
  structured-content support.
- The clarify loop is driven through `context`: callers pass answers to prior
  clarifying questions in a follow-up call.

Transport hardening: the Worker applies the shared `RATE_LIMITER` (same
IP-keyed limiter as `/v1/respond`) before dispatching to the MCP handler, and
the handler runs with `corsOptions: false` — browser CORS headers are omitted
entirely, matching the API's deny-by-default posture, while the handler still
validates any Origin that is present.

### Amendment: `createMcpHandler`, not `McpAgent`

This ADR originally proposed `McpAgent`. At implementation time Cloudflare had
deprecated and feature-frozen `McpAgent` in favour of the stateless
`createMcpHandler` (MCP SDK v2). Our endpoint is stateless — one engine call
per tool invocation, no session state — so the stateless lane is strictly
better: **no Durable Object binding, no migrations, no `wrangler.toml`
changes.** A handler is created per request (the documented stateless
lifecycle), closing over `env`; MCP notifications and listen streams, the only
features that require a module-scope handler, are unused.

The `github-mcp-gateway` project was used as a working reference. It stays on
the legacy `McpAgent` + Durable Object + `workers-oauth-provider` stack because
it needs OAuth identity and per-session state; its OAuth wiring is the
reference implementation for the auth lane planned in ADR 0004.

## Alternatives considered

- **`McpAgent` + Durable Object.** Rejected: deprecated upstream, and our
  endpoint needs no session state — the DO would be pure overhead.
- **MCP-only rewrite** (drop the HTTP API/SDK). Rejected: web frontends are
  first-class consumers; MCP complements, not replaces.
- **Standalone MCP service with its own engine.** Rejected: duplicates the
  engine; ADR 0001 exists precisely to avoid this.

## Consequences

- Any MCP host can consume the engine at `https://<worker-host>/mcp` with zero
  integration code.
- `apps/api` gains dependencies: `agents`, `@modelcontextprotocol/server`, and
  `zod` (for the tool input schema).
- The stateless lane means no resumability, pushed server requests, or session
  deletion — none of which the tool uses. If a future feature needs sessions,
  revisit with a dedicated lane rather than reintroducing `McpAgent`.
- Remote MCP makes API-key auth (ADR 0004) more urgent; until then the
  endpoint is as open as `/v1/respond`, protected only by rate limiting.
