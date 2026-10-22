# Decisions

- 2026-10-22 · Assumption: Theatre can inspect the pnpm project without migrating package managers. Verified: local Theatre 0.2.0 supports CycloneDX, but not pnpm; use a faithful SBOM adapter with exact importer edges, peer variants, and no fabricated direct roots. Theatre's npm override script is advisory and will not be applied as pnpm configuration. Its existing 13 tests pass. Reverse by removing this task's adapter/evidence, not by changing the project package manager.
- 2026-10-22 · Current main is 2a4f3d2; original checkout is 06aa0a0 with two staged prototype files. Worktree created from current main. An initially misdirected clean Theatre worktree and its task-created branch were removed before project edits. Original checkouts remain unchanged.
