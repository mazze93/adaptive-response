repo: mazze93/adaptive-response
branch: main
## Last sync
date: 2026-07-25T21:53:47Z

### Updated in this project
- Built an architecture diagram explaining the AdaptiveResponse system: what it is, the request pipeline, and how packages integrate.
- Built a working prototype that calls Claude in-browser, validates the JSON against a hand-mirrored AdaptiveResponseSchema, and renders it with the exact ResponseRenderer component tree/styling — plus inline handoff notes for wiring it to the real Worker/SDK in Claude Code.

## Screen map
| Screen | Repo files |
|---|---|
| Adaptive Response Diagram.dc.html | README.md, packages/schema/src/index.ts, packages/ui/src/components/DecisionBanner.tsx, packages/ui/src/components/ResponseRenderer.tsx, apps/demo/src/App.tsx |
| Adaptive Response Prototype.dc.html | apps/demo/src/App.tsx, packages/schema/src/index.ts, packages/ui/src/components/{DecisionBanner,TldrBlock,SectionBlock,ListBlock,AlternativesBlock,ResponseRenderer}.tsx |
