# 0004 — Distribution hardening: npm publishing, schema versioning, API auth

- **Status:** Proposed
- **Date:** 2026-09-16

## Context

The packages are workspace-private, the response contract carries no version
marker, and the deployed Worker is unauthenticated — the SDK sends an
`Authorization: Bearer` header, but the Worker never checks it. None of this
matters for a demo; all of it matters once external projects integrate (SDK, MCP,
or raw HTTP).

## Decision

1. **Publish `@adaptive/schema`, `@adaptive/core`, and `@adaptive/sdk` to npm.**
   Also ship the generated JSON Schema (`toAdaptiveResponseJsonSchema()`) as a
   build artefact for non-TypeScript consumers.
2. **Add `schema_version` to `meta`** (semver string, injected by the engine) so
   the contract can evolve without silently breaking integrators. Consumers pin a
   major; additive changes bump minor.
3. **Close the auth gap.** Optional API-key auth on the Worker: an
   `API_KEYS` Wrangler secret (comma-separated), constant-time comparison against
   the Bearer token, checked before rate limiting and the Anthropic call. Unset
   secret = open (dev/demo parity); set = enforced.

## Consequences

- Version discipline: schema changes become deliberate, versioned events with a
  changelog, not silent edits.
- The Worker stops being a free Anthropic proxy once keys are set.
- Publishing requires CI for build/test/release (changesets or similar).

## Out of scope (revisit later)

- Streaming responses.
- Per-key rate limits / usage metering.
