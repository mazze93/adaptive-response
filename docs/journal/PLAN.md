# Dependency reduction — 2026-10-22

Use Theatre of Dependencies to reduce adaptive-response's resolved dependencies and security alerts as far as practical while retaining the engine, HTTP API, MCP endpoint, SDK, UI, demo, and behavioral test coverage.

Scope: this worktree only; workspace manifests/lockfile, MCP adapter, package build configs, test runner/tests, demo build/dev tooling if justified, CI/security workflows, documentation, and dependency evidence under docs/audits/dependency-reduction-20261022. Theatre's source is read-only. The original checkout and staged prototype files are excluded.

1. Capture the committed baseline, a faithful CycloneDX graph, Theatre results, audit results, and existing validation.
2. Replace broad adapters/build tools with narrower supported or built-in capabilities; measure each cut. Keep Wrangler's real dependency cost visible.
3. Validate behavioral tests, published package imports/types, demo browser/build, Worker dry run, frozen install, and security audit; rerun Theatre.
4. Record before/after counts and remaining limits; commit the verified change on its own branch.

Rollback: base 2a4f3d228deeeb31049736459eb63398fd69cfec is unchanged. Changes are isolated on refactor/dependency-reduction-20261022. No merge or deployment is authorized by this task.

## Shipping follow-up — 2026-10-22

PR 34 is already merged. Verify and repair the two final review findings (stale dist packaging and stale manifest/specifier reporting), commit the tests, ship the follow-up, then fast-forward the original checkout to final main without stashing or committing its staged prototypes. Exact scope: four library manifests; scripts/build-package.mjs; scripts/dependency-sbom.py; scripts/test_dependency_checks.py; scripts/test-package-artifacts.py; journal and dated review-followup evidence.

Verified assumption: both review concerns reproduce on merged main a4aa326. Rollback is a revert of this follow-up against that merged base, with the original branches and staged prototype blobs preserved. Run the package delete/rebuild/pack regression on all four libraries; revalidate frozen install, build/types/tests, audits, demo and Worker bundle. Verify remote shipping and local branch/index identity separately.
