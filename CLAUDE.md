# Codebase guide for AI assistants

## What this is

A monorepo that implements a **schema-driven AI response engine**.

The core idea: instead of returning free-form text, the Anthropic API is prompted to return a structured JSON object — `AdaptiveResponse` — which is validated at runtime by a Zod schema and rendered by a set of typed React components.

The schema is the load-bearing artefact. Everything else (the Worker, the SDK, the UI) is downstream of it.

---

## Repository layout

```
packages/
  schema/   @adaptive/schema   — Zod validators + inferred TS types. Source of truth.
  sdk/      @adaptive/sdk      — AdaptiveClient fetch wrapper. Re-exports schema types.
  ui/       @adaptive/ui       — React components that render AdaptiveResponse.

apps/
  api/      @adaptive/api      — Cloudflare Worker. Calls Anthropic, validates, returns JSON.
  demo/     @adaptive/demo     — Vite + React demo. Proxies /v1 → local Worker.
```

Dependency graph (no cycles):

```
schema  ←  sdk  ←  ui
schema  ←  api
sdk     ←  demo
ui      ←  demo
```

---

## Key invariants — never break these

1. **`@adaptive/schema` is the single source of truth.** Types are never duplicated. The Worker and the SDK both import types from `@adaptive/schema`, never from each other.

2. **All schemas use `.strict()`.** Unknown keys are rejected. This is intentional — the model is expected to return exactly the contracted shape.

3. **`clarifying_questions` is required when `mode` is `"clarify"` or `"hybrid"`.** This is enforced by `superRefine` in `AdaptiveResponseSchema`. The Zod schema and the system prompt must stay in sync if either changes.

4. **Validation happens at the API boundary, not in the SDK or UI.** The Worker validates the raw Anthropic response before returning it. The SDK runs the same validation on the client side as a second check. UI components trust their props.

5. **`ANTHROPIC_API_KEY` is a Wrangler secret, never a `[vars]` entry.** Do not write it to `wrangler.toml`.

---

## Schema shape (quick reference)

```ts
interface AdaptiveResponse {
  decision: {
    mode: "answer" | "clarify" | "hybrid";
    confidence: number;              // 0–1
    ambiguity_level: "low" | "medium" | "high";
    risk_level:      "low" | "medium" | "high";
  };
  clarifying_questions?: string[];   // required when mode is "clarify" or "hybrid"
  answer: {
    tldr: string;                    // always present, 1–2 sentences
    sections?:     Array<{ title: string; content: string }>;
    assumptions?:  string[];
    alternatives?: Array<{ condition: string; approach: string }>;
    risks?:        string[];
  };
  meta: {
    intent_type: "informational" | "analytical" | "generative" | "diagnostic" | "comparative";
    complexity_score: number;        // 0–10
    tokens_estimated?: number;       // injected by the Worker from Anthropic usage data
  };
}
```

---

## Where things live

| Concern | File |
|---|---|
| Schema definition + validators | `packages/schema/src/index.ts` |
| Schema tests | `packages/schema/src/index.test.ts` |
| API client | `packages/sdk/src/index.ts` |
| Worker entry point | `apps/api/src/index.ts` |
| System prompt | `apps/api/src/index.ts` — `SYSTEM_PROMPT` constant |
| CORS logic | `apps/api/src/index.ts` — `buildCorsHeaders` |
| Top-level UI renderer | `packages/ui/src/components/ResponseRenderer.tsx` |
| Demo app | `apps/demo/src/App.tsx` |
| Vite dev proxy config | `apps/demo/vite.config.ts` |
| Worker config | `apps/api/wrangler.toml` |

---

## Common tasks

**Changing the response shape:**
1. Update `packages/schema/src/index.ts` — add/remove fields in the relevant Zod schema.
2. Update the `SYSTEM_PROMPT` in `apps/api/src/index.ts` to match.
3. Update `packages/schema/src/index.test.ts` — add tests for the new field.
4. Update UI components in `packages/ui/src/components/` as needed.

**Adding a new UI component:**
- Export it from `packages/ui/src/index.ts`.
- It receives typed props from `@adaptive/sdk` — import types from there, not directly from `@adaptive/schema`.

**Changing validation rules:**
- All validation lives in `@adaptive/schema`. Do not add Zod logic to the SDK or UI.
- Run `pnpm test` after any schema change.

**Adding a new API endpoint:**
- Add a route guard branch in the `fetch` handler in `apps/api/src/index.ts`.
- Return errors via `jsonResponse()` with appropriate status codes.

---

## Running things

```bash
pnpm install          # install all workspace dependencies
pnpm build            # build packages/schema → packages/sdk → packages/ui
pnpm test             # run all package tests (vitest)
pnpm typecheck        # tsc --noEmit across all packages
pnpm dev:api          # wrangler dev (localhost:8787)
pnpm dev:demo         # vite dev (localhost:5173, proxies /v1 → :8787)
```

---

## What to avoid

- **Do not add runtime type narrowing in UI components.** The schema is the boundary; by the time data reaches the UI it is already typed.
- **Do not use `as Record<string, unknown>` casts** to work around schema types. If a field needs to be mutable after parsing, assign it directly — Zod output objects are plain mutable objects.
- **Do not add fields to `wrangler.toml [vars]` that are secrets.** Use `wrangler secret put`.
- **Do not define `AdaptiveResponse` or its sub-types anywhere other than `@adaptive/schema`.** Not in the Worker, not in the demo, not inline in components.
- **Do not skip the `.strict()` call** when extending schemas. The model should return exactly the contracted shape.
