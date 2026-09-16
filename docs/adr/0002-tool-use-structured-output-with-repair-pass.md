# 0002 — Enforce structured output via Anthropic tool-use, with a single repair pass

- **Status:** Accepted
- **Date:** 2026-09-16

## Context

The Worker prompted the model with a hand-written TypeScript interface embedded in
`SYSTEM_PROMPT` and asked for "JSON, no markdown fences". This had three problems:

1. **Drift risk.** The prompt was a manually maintained copy of the Zod schema.
   Invariant #3 in `CLAUDE.md` ("schema and system prompt must stay in sync")
   existed only as discipline, not as mechanism.
2. **Fragile parsing.** The Worker stripped markdown fences and `JSON.parse`d free
   text; any deviation produced a 502.
3. **No recovery.** A response that failed Zod validation was terminal — one bad
   generation cost the caller the whole request.

Anthropic tool-use with a forced `tool_choice` makes the model emit arguments
conforming to a JSON Schema, returned pre-parsed in a `tool_use` content block.
Zod 4 can generate that JSON Schema directly from our source-of-truth schema
(`z.toJSONSchema`).

## Decision

1. **Force a tool call.** `@adaptive/core` calls the Messages API with a single
   tool, `emit_adaptive_response`, and `tool_choice: { type: "tool", name: … }`.
   The tool's `input_schema` is generated from `AdaptiveResponseSchema` at
   runtime — the schema package stays the single source of truth for *shape*, by
   construction rather than by convention.
2. **Encode the cross-field invariant in JSON Schema.** `superRefine` constraints
   are not representable by `z.toJSONSchema`, so `@adaptive/schema` exports
   `toAdaptiveResponseJsonSchema()`, which appends the
   "`clarifying_questions` required when mode is `clarify`/`hybrid`" rule as a
   JSON Schema `allOf`/`if`/`then` conditional. The same artefact will serve as
   the MCP tool `outputSchema` (ADR 0003) and a published contract for non-TS
   consumers (ADR 0004).
3. **Keep a policy-only system prompt.** The prompt no longer describes the shape
   (the tool schema does); it carries only decision policy — mode thresholds,
   tldr length, "don't set `tokens_estimated`".
4. **One repair pass.** If the tool input fails Zod validation, the engine sends
   the failed `tool_use` block back with an `is_error` `tool_result` listing the
   Zod issues and forces the tool once more. A second failure returns
   `invalid_model_output` with the issues. Exactly one repair bounds worst-case
   latency/cost at two model calls.
5. **`tokens_estimated` is engine-injected.** It is removed from the *tool*
   schema (the model must not guess it) but remains in the canonical schema; the
   engine sums real `usage` tokens across both calls.

## Alternatives considered

- **Keep prompt-embedded JSON.** Rejected: drift and fence-stripping fragility.
- **Unbounded repair loop.** Rejected: unbounded cost/latency; a model that fails
  the schema twice under a forced tool is not going to converge cheaply.
- **Strip `.strict()` / loosen the schema to raise pass rates.** Rejected:
  violates the contract-first premise (CLAUDE.md invariant #2).

## Consequences

- Markdown-fence stripping and free-text JSON parsing are deleted.
- Schema shape changes now propagate to the model automatically; only *policy*
  changes (mode thresholds etc.) require touching the prompt.
- Transient shape errors self-heal at the cost of one extra model call.
- `tokens_estimated` now reflects total spend including the repair call.
- The Anthropic request/response surface in tests changes from text blocks to
  `tool_use` blocks.
