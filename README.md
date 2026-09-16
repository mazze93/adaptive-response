# Adaptive Response

> Schema-driven AI response engine — Cloudflare Worker → Anthropic Claude → Zod-validated typed JSON → React UI.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://typescriptlang.org)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange)](https://workers.cloudflare.com)
[![Zod](https://img.shields.io/badge/Zod-schema--validated-green)](https://zod.dev)

**Problem:** LLM responses are unstructured and unpredictable in production pipelines.  
**Solution:** Force the model to emit a typed, validated JSON object — with confidence scores, clarifying-question routing, and risk metadata — every time.

The model is *forced* to call a tool whose `input_schema` is generated from the Zod schema at runtime, so the shape cannot drift from the contract. Every response is validated at the engine boundary; if validation fails, the engine feeds the exact Zod issues back to the model for one repair pass before giving up. Architectural decisions are traced in [`docs/adr/`](docs/adr/README.md).

---

## How it works

```
User query
  → POST /v1/respond (HTTP JSON)  ─┬─  (Cloudflare Worker — thin transports)
  → POST /mcp (MCP tool call)    ─┘
  → @adaptive/core generateAdaptiveResponse()
      → Anthropic Messages API (claude-sonnet-4-6), forced tool_choice:
        emit_adaptive_response — input_schema generated from the Zod schema
      → tool input validated against AdaptiveResponseSchema (Zod)
      → on validation failure: one repair pass (Zod issues fed back as an
        error tool_result), then fail with a typed engine error
  → AdaptiveResponse returned to client
  → ResponseRenderer displays it
```

The model decides whether to answer directly, ask clarifying questions, or do both (`answer | clarify | hybrid`). Every response carries a confidence score, ambiguity/risk levels, a TLDR, optional sections, assumptions, alternatives, and risks — all enforced by the schema.

---

## Packages

| Package | Description |
|---|---|
| `packages/schema` | Zod validators, inferred TypeScript types, and the JSON Schema export. Single source of truth. |
| `packages/core` | Runtime-agnostic engine: forced tool-use call to Anthropic, Zod validation, one repair pass, retry/backoff. Embeddable in any modern JS runtime. |
| `packages/sdk` | `AdaptiveClient` — typed fetch wrapper for `/v1/respond`. Re-exports all types from `@adaptive/schema`. |
| `packages/ui` | React components: `ResponseRenderer`, `DecisionBanner`, `TldrBlock`, `SectionBlock`, `ListBlock`, `AlternativesBlock`. |
| `apps/api` | Cloudflare Worker. Thin HTTP + MCP transports over `@adaptive/core`. |
| `apps/demo` | Vite + React demo app. Proxies `/v1` to the local Worker in dev. |

---

## Embedding the engine directly

You don't need the Worker to use the engine — `@adaptive/core` runs in any modern
JS runtime (Node ≥ 20, Workers, Bun) and returns typed results instead of throwing:

```ts
import { generateAdaptiveResponse } from "@adaptive/core";

const result = await generateAdaptiveResponse(
  { query: "Should we use Postgres or D1 for this?", context: "We deploy on Cloudflare." },
  { apiKey: env.ANTHROPIC_API_KEY },
);

if (result.ok) {
  result.response.decision.mode; // "answer" | "clarify" | "hybrid"
} else {
  result.code; // "upstream_error" | "malformed_response" | "invalid_model_output"
}
```

---

## MCP endpoint

The Worker also serves the engine over MCP (Streamable HTTP) at `/mcp` — see
[ADR 0003](docs/adr/0003-expose-engine-as-mcp.md). Any MCP host (Claude
Desktop/Code, Zed, Cursor) can connect with zero integration code:

```jsonc
// e.g. in an MCP client config
{
  "adaptive-response": {
    "url": "https://adaptive-api.your-account.workers.dev/mcp"
  }
}
```

One tool is exposed — `adaptive_respond` `{ query, context? }`. It returns the
full `AdaptiveResponse` as `structuredContent` (typed by an `outputSchema`
generated from the Zod contract) plus a text fallback. When the decision mode
is `clarify` or `hybrid`, answer the returned `clarifying_questions` and call
the tool again with those answers in `context`.

A local stdio package (`npx @adaptive/mcp`) is planned — see ADR 0003.

---

## Getting started

**Prerequisites:** Node ≥ 20, pnpm ≥ 9, a Cloudflare account, an Anthropic API key.

```bash
# Install dependencies
pnpm install

# Build packages (schema → sdk → ui, in dependency order)
pnpm build

# Start the API Worker locally (requires wrangler)
pnpm dev:api

# In a second terminal, start the demo app
pnpm dev:demo
# → http://localhost:5173
```

The demo app proxies `/v1` to `localhost:8787` (the Worker) so no CORS configuration is needed in development.

---

## API key setup

The Worker reads `ANTHROPIC_API_KEY` from a Wrangler secret — never from `wrangler.toml`.

```bash
cd apps/api
npx wrangler secret put ANTHROPIC_API_KEY
# paste your key when prompted
```

### Protecting the endpoints (ADR 0004)

Both `/v1/respond` and `/mcp` accept an optional Bearer-key gate. Set the
`API_KEYS` secret (comma-separated keys) and every request must carry
`Authorization: Bearer <key>`; leave it unset for open dev/demo access:

```bash
npx wrangler secret put API_KEYS
# e.g. paste: key-for-app-a,key-for-app-b
```

The SDK's `apiKey` config sends this header automatically. `/health` stays open.

---

## Environment variables

Set in `apps/api/wrangler.toml` under `[vars]`:

| Variable | Default | Description |
|---|---|---|
| `ANTHROPIC_MODEL` | `claude-sonnet-4-6` | Model used for all requests. |
| `ALLOWED_ORIGINS` | `""` | Comma-separated CORS origins. **Empty = deny all cross-origin requests.** Set your production origin(s) before deploying. Never use `*` in production. |

For the demo app, set `VITE_API_URL` to point at a deployed Worker (leave unset in dev to use the Vite proxy):

```bash
# apps/demo/.env.local
VITE_API_URL=https://adaptive-api.your-account.workers.dev
```

---

## Development commands

```bash
pnpm build        # Build all packages
pnpm test         # Run all package tests
pnpm typecheck    # Type-check all packages
pnpm clean        # Delete all dist/ directories
```

---

## Deploying the Worker

```bash
cd apps/api
npx wrangler deploy
```

Make sure `ANTHROPIC_API_KEY` is already set as a secret in your Cloudflare account before deploying.

---

## AdaptiveResponse schema

```ts
interface AdaptiveResponse {
  decision: {
    mode: "answer" | "clarify" | "hybrid";
    confidence: number;          // 0–1
    ambiguity_level: "low" | "medium" | "high";
    risk_level: "low" | "medium" | "high";
  };
  clarifying_questions?: string[]; // required when mode is "clarify" or "hybrid"
  answer: {
    tldr: string;
    sections?: Array<{ title: string; content: string }>;
    assumptions?: string[];
    alternatives?: Array<{ condition: string; approach: string }>;
    risks?: string[];
  };
  meta: {
    intent_type: "informational" | "analytical" | "generative" | "diagnostic" | "comparative";
    complexity_score: number;    // 0–10
    tokens_estimated?: number;   // injected by the engine from Anthropic usage data
    schema_version?: string;     // injected by the engine (SCHEMA_VERSION, semver)
  };
}
```

`@adaptive/schema` is the canonical definition. The Worker and the SDK both import from it — never define these types elsewhere.

---

## Security

See [SECURITY.md](SECURITY.md) for the responsible disclosure policy.

Key hardening decisions in this project:
- `ALLOWED_ORIGINS` defaults to `""` (deny-by-default). You must explicitly allowlist origins.
- `ANTHROPIC_API_KEY` is stored as a Wrangler secret — it never appears in `wrangler.toml` or source.
- Optional `API_KEYS` secret gates `/v1/respond` and `/mcp` with constant-time Bearer-key checks (ADR 0004).
- Worker responses include `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and `Referrer-Policy: no-referrer`.
- Upstream (Anthropic) errors are logged internally via `console.error` and never returned to callers.
