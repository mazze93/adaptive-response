# 0004 — Distribution hardening: npm publishing, schema versioning, API auth

- **Status:** Accepted — auth and `schema_version` implemented 2026-09-16; npm publishing prepared but pending a scope decision
- **Date:** 2026-09-16

## Context

The packages are workspace-private, the response contract carries no version
marker, and the deployed Worker was unauthenticated — the SDK sends an
`Authorization: Bearer` header, but the Worker never checked it. None of this
matters for a demo; all of it matters once external projects integrate (SDK,
MCP, or raw HTTP). The MCP endpoint (ADR 0003) made the auth gap more urgent:
it invites third-party clients to point at the Worker.

## Decision

1. **Publish `@adaptive/schema`, `@adaptive/core`, and `@adaptive/sdk` to npm.**
   Also ship the generated JSON Schema (`toAdaptiveResponseJsonSchema()`) as a
   build artefact for non-TypeScript consumers.
   *Implemented so far:* publish metadata on all four packages (`license`,
   `repository`, `files: ["dist"]`, `publishConfig.access: public`).
   *Open question:* the `@adaptive` npm scope is unlikely to be available; the
   packages may need a rename (e.g. a scope the owner controls) before first
   publish. Renaming is a breaking decision — record it as an amendment here
   when made. CI release automation (changesets or similar) is also pending.

2. **Add `schema_version` to `meta`.** *Implemented:* `@adaptive/schema`
   exports `SCHEMA_VERSION` (semver, currently `0.1.0`); `meta.schema_version`
   is an optional contract field. The engine stamps it on every successful
   response — engine-owned, overriding anything the model emits, and stripped
   from the model-facing tool schema exactly like `tokens_estimated`.
   Consumers pin a major; additive changes bump the minor; every bump is
   recorded in an ADR.

3. **Close the auth gap.** *Implemented:* an optional `API_KEYS` Wrangler
   secret (comma-separated Bearer keys) guards both `/v1/respond` and `/mcp`,
   checked before rate limiting and the Anthropic call. Unset secret = open
   (dev/demo parity); set = enforced with `401` + `WWW-Authenticate: Bearer`.
   Keys are compared as SHA-256 digests with a constant-time byte loop and no
   early exit across the key list, so timing reveals neither where a mismatch
   occurs nor which key position matched. `/health` and CORS preflights stay
   open.

## Alternatives considered

- **OAuth (as in `github-mcp-gateway`).** Right for user-identity scenarios;
  overkill for service-to-service keys today. The gateway's
  `workers-oauth-provider` wiring is the reference implementation if MCP hosts
  later require OAuth discovery — that would supersede this section, not the
  Bearer lane.
- **`crypto.subtle.timingSafeEqual`.** Workers-only; the digest-XOR compare is
  portable across Workers and Node (tests run in Node).

## Consequences

- Version discipline: schema changes become deliberate, versioned events, not
  silent edits. Integrators can branch on `meta.schema_version`.
- The Worker stops being a free Anthropic proxy once `API_KEYS` is set; the
  SDK's existing `apiKey` config now actually authenticates.
- Publishing still requires: scope decision, npm account, CI release workflow.

## Out of scope (revisit later)

- Streaming responses.
- Per-key rate limits / usage metering.
- OAuth for MCP hosts (see gateway reference above).
