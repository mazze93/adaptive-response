# Adaptive Response

> Schema-driven AI response engine — Cloudflare Worker → Anthropic Claude → Zod-validated typed JSON → React UI.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://typescriptlang.org)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange)](https://workers.cloudflare.com)
[![Zod](https://img.shields.io/badge/Zod-schema--validated-green)](https://zod.dev)

**Problem:** LLM responses are unstructured and unpredictable in production pipelines.  
**Solution:** Force the model to emit a typed, validated JSON object — with confidence scores, clarifying-question routing, and risk metadata — every time.

Every response is run through a Zod schema at the API boundary. If the model hallucinates a shape, the Worker returns a 502 before bad data reaches your frontend.

---

## How it works

```
User query
  → POST /v1/respond  (Cloudflare Worker)
  → Anthropic Messages API  (claude-sonnet-4-6)
  → JSON parsed + validated against AdaptiveResponseSchema (Zod)
  → AdaptiveResponse returned to client
  → ResponseRenderer displays it
```

The model decides whether to answer directly, ask clarifying questions, or do both (`answer | clarify | hybrid`). Every response carries a confidence score, ambiguity/risk levels, a TLDR, optional sections, assumptions, alternatives, and risks — all enforced by the schema.

---

## Packages

| Package | Description |
|---|---|
| `packages/schema` | Zod validators and inferred TypeScript types. Single source of truth. |
| `packages/sdk` | `AdaptiveClient` — typed fetch wrapper for `/v1/respond`. Re-exports all types from `@adaptive/schema`. |
| `packages/ui` | React components: `ResponseRenderer`, `DecisionBanner`, `TldrBlock`, `SectionBlock`, `ListBlock`, `AlternativesBlock`. |
| `apps/api` | Cloudflare Worker. Calls Anthropic, validates the response, returns `AdaptiveResponse` JSON. |
| `apps/demo` | Vite + React demo app. Proxies `/v1` to the local Worker in dev. |

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
    tokens_estimated?: number;
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
- Worker responses include `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and `Referrer-Policy: no-referrer`.
- Upstream (Anthropic) errors are logged internally via `console.error` and never returned to callers.
