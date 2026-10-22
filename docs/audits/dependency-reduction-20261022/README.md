# Theatre-guided dependency reduction — 2026-10-22

Base: `2a4f3d228deeeb31049736459eb63398fd69cfec` on `mazze93/adaptive-response`.
The original checkout and its staged prototype files are outside this worktree.

The owner asked to minimize dependencies using Theatre of Dependencies, then
clarified to follow Theatre's recommendation and include the tests in commits.
This pass follows its single recommended entrance: `agents@0.28.1`.

## Measured graph

| Measure | Before | After | Reduction |
|---|---:|---:|---:|
| Package/version records in pnpm lockfile | 423 | 225 | 46.8% |
| Unique package names in lockfile | 386 | 223 | 42.2% |
| Reachable snapshots (peer variants kept distinct) | 426 | 225 | 47.2% |
| Production-reachable snapshots, including optional dependencies | 229 | 6 | 97.4% |
| Advisories reported by pnpm audit and OSV | 2 moderate | 0 | Both removed |

The production row folds every workspace's runtime dependencies into one graph,
including the demo. It is an installed-graph measurement, not a Worker bundle
size or exploitability measurement. Platform binaries and optional packages are
included in lockfile counts. Development dependencies still include Wrangler,
Vite, Vitest, TypeScript, and Biome; their real cost remains visible.

## Theatre recommendation and implementation

The baseline Theatre report proposes one act, `agents`, carrying
`GHSA-5r4p-p66f-jhc7` (Hono) and `GHSA-rxp7-6hxx-x8q5` (ip-address).
Its sample script suggests scoped npm overrides. Theatre's documented meaning of
an act permits an upgrade, scoped override, or replacement of that entrance.
Here, the narrower official MCP SDK was already installed and provides the
needed web-standard handler. Replacing `agents` removes the older MCP SDK and
both affected subtrees; no advisory waiver or leaf override is used.

The four library builds also use their existing TypeScript compiler instead of
`tsup`, preserving ESM, declarations, declaration maps, and source maps.
`after-adapter-and-build/` captures that completed implementation step.

The owner then directed the remaining work to Theatre's recommendation, so this
pass preserves Vitest and the Vite demo instead of replacing them with custom
test/build infrastructure. The final Theatre report contains no acts and no
unfixed advisories. Its `CLOSED` baseline state was a prediction that the
recommended act could cover all known advisories, not evidence the original
installation was clean. Only the regenerated graph and actual audits establish
the measured after-state.

## Provenance and reproduction

Theatre 0.2.0 at `45c356fe1b92b2de9f9f49db7442630a7021e1b7` passed its 13 own
tests. Its repository was used read-only. It does not natively support pnpm.
`scripts/dependency-sbom.py` exports a CycloneDX graph from pnpm lockfile v9
importers and snapshots, retaining peer identities, every shared parent path,
and workspace manifest ownership. All baseline and after snapshots are
reachable from real direct entrances; there are no missing edges or invented
roots. Missing targets, unmodeled workspace links, and manifest mismatches fail.
The exporter and version validator have committed regression tests.

Each phase contains `sbom.json`, `graph-summary.json`, and `theatre.json`.
`provenance.json` verifies every component has a saved OSV query result and every
referenced advisory has a saved record. `osv-snapshot.json` preserves those raw
query/advisory responses without adding hundreds of cache files to Git.
Package names and versions were sent to OSV.dev as part of the requested scan.

From the repository root, regenerate an input:

```sh
python3 scripts/dependency-sbom.py . /tmp/adaptive-response-sbom
node /path/to/theatre-of-dependencies/bin/theatre.mjs scan /tmp/adaptive-response-sbom/sbom.json --json --no-anim
```

To reproduce against the frozen advisory snapshot, restore the cache:

```python
import json
from pathlib import Path
snapshot = json.loads(Path('docs/audits/dependency-reduction-20261022/osv-snapshot.json').read_text())
cache = Path('/tmp/adaptive-response-osv-cache')
for kind, entries in snapshot.items():
    (cache / kind).mkdir(parents=True, exist_ok=True)
    for name, data in entries.items():
        (cache / kind / name).write_text(json.dumps(data))
```

Then pass `--offline --cache /tmp/adaptive-response-osv-cache` to Theatre with
either saved SBOM. The saved before/after `stage.html` files are the generated
animated playthroughs; their matching `playbill.txt` files retain terminal output.
OSV and registry results can change after this dated snapshot.

## Validation and limits

`before/checks.json` records the base's build/typecheck/93-test baseline.
Its frozen install initially failed because root overrides did not match the
committed lockfile. For baseline behavior only, the unmatched policy was
removed temporarily, the exact lockfile installed with lifecycle scripts
disabled, and package.json restored. That exception and install output are
preserved; it is not presented as a passing untouched frozen install.

`after/checks.json` records final command exits. The project suite now has 101
passing assertions, including eight MCP boundary regression cases. Python
regressions cover empty or invalid version evidence, nested vulnerable copies,
shared dependency paths, workspace links, and SBOM provenance. The packed-package
check imports all four actual tarballs with no workspace package links, exercises
the engine and SDK with fixture responses, server-renders the React UI, and
compiles consumer TypeScript declarations. It passed under Node 20.20.2 and
24.21.0. The harness denies unmocked network requests.

The demo builds and its production HTML/JS assets respond over HTTP. A local
Wrangler runtime serves `/health`, lists `adaptive_respond` over MCP, and rejects
an attacker Origin; see `after/local-worker-http.json`. No live model call or
production deployment is part of acceptance. Browser automation has no enabled
browser surfaces in this session, so no visual-browser verification is claimed.
Wrangler retains its expected warning about the experimental rate-limit binding.

CI and release use a pinned package manager and frozen lockfile. The security
workflow fails at every advisory severity and fails closed on missing esbuild
version evidence. Security updates are explicitly grouped to reduce PR noise.

GitHub's default-branch alerts only change after the branch reaches `main` and
GitHub rescans. A clean branch audit does not mean the default branch or a
previous deployment has already changed.
