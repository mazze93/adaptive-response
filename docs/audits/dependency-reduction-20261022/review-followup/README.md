# Review corrections and shipping follow-up — 2026-10-22

PR #34 was already merged at `a4aa326884728ec8cbeed766de520b5fb29f03b2`
when the owner requested the suggested fixes, shipping, and an updated local
checkout. Both final Greptile findings were independently reproduced on that
merged source; see `red-checks.json`, `exporter-red.txt`, and `packaging-red.txt`.

## Corrections

1. Library output cleanup: every library build now calls a built-in-only Node
   helper that accepts only schema/core/sdk/ui, removes that library's generated
   dist directory, then runs the existing TypeScript compiler. No bundler or
   dependency is restored. The package test creates an extra source module,
   builds it, deletes it, rebuilds, and inspects the packed archive in an
   isolated copy of each of the four libraries. JavaScript, declarations, and
   both maps must disappear, and none can remain in the tarball.
2. Importer validation: the exporter compares dependency names in every
   supported manifest group, including groups absent from the lockfile, and
   matches each declared range against the lockfile specifier. Missing
   specifiers or versions fail. Empty importers remain modeled so new manifest
   groups cannot disappear from validation. Regression tests cover newly added
   optional groups, changed runtime/dev/optional ranges, and incomplete entries.

## Acceptance

All commands in `green-checks.json` passed: frozen install, library builds,
workspace typecheck, 101 project assertions, 14 Python regression tests, the four
real delete/rebuild/pack regressions plus packed ESM/declaration consumers, full
source lint, zero-advisory pnpm audit, demo build, and Worker deployment dry-run.
The existing Wrangler experimental-rate-limit-binding warning remains.

`graph-invariance.json` confirms the generated SBOM is byte-for-byte equivalent
as JSON to the previous validated Theatre after-state. The lockfile remains
unchanged, with 225 package/version entries; these review fixes add no packages.

## Delivery boundary

The original checkout's two staged prototype blob IDs were captured before
updating it and a private temporary binary patch was saved for recovery. They
remain excluded from shipping commits. The previous dependency-fix branch is
retained as an additional rollback reference.

Cloudflare's configured `adaptive-api` Worker was not found in the currently
authenticated account (API code 10007), and GitHub records no Worker deployments
for this repository. This follow-up ships repository/build/report fixes; it
does not create an unauthenticated new public Worker or publish npm packages.
GitHub PR/commit state and the final local HEAD/index checks are the delivery
receipts; a passing dry-run alone is not presented as a live deployment.
