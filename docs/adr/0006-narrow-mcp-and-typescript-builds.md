# 0006 — Narrow MCP dependencies and use TypeScript library builds

- **Status:** Accepted
- **Date:** 2026-10-22
- **Supersedes:** ADR 0003's handler dependency choice only

## Context

The remote endpoint needs one stateless MCP handler. The broad Cloudflare
Agents package brings both MCP SDK generations and optional platform/build
features. Theatre of Dependencies identifies that package as the sole entrance
carrying the current Hono and ip-address advisories. The official MCP SDK
already used by the server exports a fetch-native handler and the Host/Origin
validation helpers needed by this Worker.

The four public packages already require TypeScript for declarations. Their
source uses standard ESM with explicit `.js` import paths. A second bundler is
unnecessary for this library output.

## Decision

- Import `createMcpHandler` directly from `@modelcontextprotocol/server`.
  Preserve the former adapter's Host and Origin checks explicitly, along with
  the existing authentication, rate limiting, CORS policy, and stateless server
  factory. Support both modern and legacy stateless MCP through the SDK.
- Remove `agents`. Do not replace it with copied platform implementation code
  or leaf overrides. This removes the carrier rather than hiding its findings.
- Build each public package's ESM, declarations, declaration maps, and source
  maps with its existing `tsc -p tsconfig.build.json` command. Keep test files
  excluded from published output. Remove `tsup`.
- Pin the package manager and require frozen installs in CI and release. Audit
  every severity. Verify every esbuild version using structured pnpm output;
  missing evidence fails the check.

## Consequences

MCP continues on the same route, with the same tool and schema. Its transport
boundary now belongs explicitly to this repository. Regression tests cover
untrusted/opaque/malformed Origins, permitted local and workers.dev Origins,
spoofed Host, malformed JSON, and rejected session methods, in addition to the
existing auth/rate-limit/tool-call tests.

Packed-consumer tests verify the actual tarballs' ESM imports, engine, SDK, React
rendering, and TypeScript declarations, independently of workspace package links.
They deny unmocked network requests and reuse the tested third-party versions.

Vitest, Vite, and Wrangler retain their existing responsibilities. Further
replacement is a separate architectural decision; the owner directed this pass
to follow Theatre's recommended entrance cut.

The dated [audit report](../audits/dependency-reduction-20261022/README.md) owns
measurements, execution evidence, tool provenance, and remaining limits.
