# 0001 — Extract a runtime-agnostic core engine (`@adaptive/core`)

- **Status:** Accepted
- **Date:** 2026-09-16

## Context

The engine that produces an `AdaptiveResponse` — system prompt, Anthropic Messages
call, retry/backoff, output validation — lived entirely inside the Cloudflare
Worker's `fetch` handler (`apps/api/src/index.ts`). That coupled the core value of
the project (the validated decision contract) to one transport (HTTP) and one
runtime (Workers).

We want the engine consumable from multiple surfaces: the existing HTTP API, a
future MCP server (remote and stdio — see ADR 0003), and direct embedding in any
JS runtime (Node, Workers, Bun) without deploying our Worker.

## Decision

Extract the engine into a new workspace package, **`@adaptive/core`**, exposing:

- `generateAdaptiveResponse(input, config)` — query/context in, discriminated
  `EngineResult` out (`ok` with a validated `AdaptiveResponse`, or a typed error:
  `upstream_error` | `malformed_response` | `invalid_model_output`).
- `fetchWithRetry` — the existing exponential-backoff-with-full-jitter retry
  helper, moved out of the Worker.
- The tool definition used for structured output (see ADR 0002).

The package depends only on `@adaptive/schema` and web-standard APIs (`fetch`,
`AbortController`) so it runs unchanged in any modern JS runtime. It returns
result objects rather than throwing, so each transport maps errors to its own
envelope (HTTP status codes, MCP error content, etc.) without exception plumbing.

The Worker (`apps/api`) becomes a thin HTTP shell: routing, CORS, rate limiting,
body validation, and error→status mapping. Secrets stay at the transport layer;
`@adaptive/core` receives the API key via config and never reads env itself.

Updated dependency graph (still acyclic):

```
schema ← core ← api
schema ← sdk  ← ui
sdk, ui ← demo
```

## Alternatives considered

- **Leave the engine in the Worker; give MCP servers their own copy.** Rejected:
  duplicates prompt/validation/repair logic, guaranteeing drift — the exact
  failure mode the schema-first design exists to prevent.
- **Make the SDK the shared engine.** Rejected: the SDK is a client of the
  deployed API and must not hold an Anthropic API key; embedding provider calls
  in it would blur the client/server boundary.

## Consequences

- New transports (MCP, CLI, queues) become thin adapters over one function.
- The engine is testable without a Workers runtime or HTTP layer.
- One more package to build/publish; `@adaptive/api` gains a workspace dependency.
- Invariant update: validation still happens "at the API boundary", but the
  boundary implementation now lives in `@adaptive/core`; every transport calls it.
