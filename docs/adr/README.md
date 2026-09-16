# Architecture Decision Records

Decisions that shape this codebase, recorded so they can be traced, revisited, and
superseded deliberately. Format follows [Michael Nygard's ADR template](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions):
Context → Decision → Consequences, with an explicit status.

New ADRs get the next sequential number. Never edit an accepted ADR's decision —
supersede it with a new one and cross-link.

| # | Title | Status |
|---|---|---|
| [0001](0001-extract-runtime-agnostic-core-engine.md) | Extract a runtime-agnostic core engine (`@adaptive/core`) | Accepted |
| [0002](0002-tool-use-structured-output-with-repair-pass.md) | Enforce structured output via Anthropic tool-use, with a single repair pass | Accepted |
| [0003](0003-expose-engine-as-mcp.md) | Expose the engine as MCP (remote + stdio) | Accepted (stdio pending) |
| [0004](0004-distribution-hardening.md) | Distribution hardening: npm publishing, schema versioning, API auth | Accepted (npm publish pending) |
| [0005](0005-cipher-gothic-demo-restyle.md) | Restyle the demo on the Cipher Gothic design system | Proposed |
