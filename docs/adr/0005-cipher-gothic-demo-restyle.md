# 0005 — Restyle the demo on the Cipher Gothic design system

- **Status:** Proposed
- **Date:** 2026-09-16

## Context

A design prototype exists for the demo surface: an architecture diagram and a
working in-browser prototype of the Adaptive Response UI, built on the
**Cipher Gothic** design system (obsidian ground, two-temperature teal,
single-use coral; serif/mono editorial pairing). The export is preserved in-repo
at [`docs/design/adaptive-response-prototype/`](../design/adaptive-response-prototype/)
with a screen map back to repo files in its `github.md`.

Notable: the prototype calls Claude in-browser against a *hand-mirrored* copy of
`AdaptiveResponseSchema` and re-creates the `ResponseRenderer` component tree
with inline styles. That is fine for a design artefact but violates two codebase
rules if ported literally: the schema must never be duplicated (CLAUDE.md
invariant #1), and API keys must never reach the browser.

## Decision

Adopt Cipher Gothic as the visual direction for `apps/demo`, treating the
prototype as a **styling and layout reference only**:

- Import `colors_and_type.css` tokens into the demo; restyle
  `packages/ui` components (`ResponseRenderer`, `DecisionBanner`, `TldrBlock`,
  `SectionBlock`, `ListBlock`, `AlternativesBlock`) to match the prototype's
  metadata-strip / bordered-section presentation.
- Keep the existing data path unchanged: demo → `@adaptive/sdk` →
  Worker → `@adaptive/core`. The prototype's in-browser Anthropic call and
  mirrored schema are explicitly **not** ported.
- Keep `packages/ui` theme-able (CSS custom properties, no hardcoded palette)
  so consumers outside this brand can restyle it.

## Consequences

- The demo becomes a branded showcase; UI package gains a token-based theming
  contract.
- The design export in `docs/design/` is a read-only reference; it is not built,
  linted, or type-checked.
