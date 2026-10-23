#!/usr/bin/env python3
"""Check real packed ESM/declaration artifacts in an isolated consumer.

Uses the exact already-installed third-party versions, with no registry writes,
downloads, workspace package links, or new dependencies. Build packages first.
"""

import json
import shutil
import subprocess
import tarfile
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
PACKAGES = ("schema", "core", "sdk", "ui")


def run(args, cwd=ROOT):
    result = subprocess.run(args, cwd=cwd, capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(f"{args}\n{result.stdout}\n{result.stderr}")
    return result.stdout


def verify_deleted_module_is_not_packed(name):
    """Reproduce a real source deletion in an isolated, previously built package."""
    with tempfile.TemporaryDirectory(prefix="adaptive-response-rebuild-") as directory:
        fixture = Path(directory)
        for filename in ["package.json", "pnpm-workspace.yaml", "tsconfig.base.json"]:
            shutil.copyfile(ROOT / filename, fixture / filename)
        (fixture / "node_modules").symlink_to(ROOT / "node_modules", target_is_directory=True)
        for sibling in PACKAGES:
            package = fixture / "packages" / sibling
            package.mkdir(parents=True)
            shutil.copyfile(ROOT / "packages" / sibling / "package.json", package / "package.json")
        package = fixture / "packages" / name
        source = ROOT / "packages" / name
        shutil.copytree(source / "src", package / "src")
        for config in ["tsconfig.json", "tsconfig.build.json"]:
            shutil.copyfile(source / config, package / config)
        (package / "node_modules").symlink_to(source / "node_modules", target_is_directory=True)
        helper = ROOT / "scripts/build-package.mjs"
        if helper.exists():
            (fixture / "scripts").mkdir()
            shutil.copyfile(helper, fixture / "scripts/build-package.mjs")
        probe = package / "src/__cleanup_probe__.ts"
        probe.write_text("export const cleanupProbe = true;\n")
        run(["pnpm", "-C", str(package), "build"], fixture)
        outputs = [package / f"dist/__cleanup_probe__{suffix}"
                   for suffix in [".js", ".js.map", ".d.ts", ".d.ts.map"]]
        assert all(path.exists() for path in outputs), f"{name}: fixture never built"
        probe.unlink()
        run(["pnpm", "-C", str(package), "build"], fixture)
        assert not any(path.exists() for path in outputs), f"{name}: deleted module outputs survived rebuild"
        run(["pnpm", "-C", str(package), "pack", "--pack-destination", directory], fixture)
        archives = list(fixture.glob("*.tgz"))
        assert len(archives) == 1, f"{name}: expected one packed archive"
        with tarfile.open(archives[0]) as archive:
            assert not any("__cleanup_probe__" in member.name for member in archive), (
                f"{name}: deleted module shipped in packed archive"
            )


for package_name in PACKAGES:
    verify_deleted_module_is_not_packed(package_name)
print(json.dumps({"deleted_module_rebuild_and_pack": list(PACKAGES), "result": "passed"}))


with tempfile.TemporaryDirectory(prefix="adaptive-response-pack-") as directory:
    consumer = Path(directory)
    modules = consumer / "node_modules"
    scope = modules / "@adaptive-response"
    scope.mkdir(parents=True)
    (consumer / "package.json").write_text('{"private":true,"type":"module"}\n')
    packed = []
    for name in PACKAGES:
        run(["pnpm", "-C", f"packages/{name}", "pack", "--pack-destination", directory])
        archive = consumer / f"adaptive-response-{name}-0.1.0.tgz"
        if not archive.exists():
            candidates = list(consumer.glob(f"adaptive-response-{name}-*.tgz"))
            if len(candidates) != 1:
                raise RuntimeError(f"Expected one packed {name} archive, got {candidates}")
            archive = candidates[0]
        target = scope / name
        target.mkdir()
        with tarfile.open(archive) as source:
            source.extractall(target, filter="data")
        package = target / "package"
        for member in package.iterdir():
            member.rename(target / member.name)
        package.rmdir()
        manifest = json.loads((target / "package.json").read_text())
        if any(v.startswith("workspace:") for v in manifest.get("dependencies", {}).values()):
            raise RuntimeError(f"Unrewritten workspace reference in packed {name}")
        if not (target / "dist/index.js").exists() or not (target / "dist/index.d.ts").exists():
            raise RuntimeError(f"Missing public artifacts in {name}")
        if list((target / "dist").rglob("*.test.*")):
            raise RuntimeError(f"Tests accidentally included in {name} runtime artifacts")
        packed.append(manifest["name"])

    # Dependency links point to exact third-party packages from the tested
    # lockfile. The four workspace packages themselves come only from tarballs.
    for name, source in {
        "zod": ROOT / "packages/schema/node_modules/zod",
        "react": ROOT / "apps/demo/node_modules/react",
        "react-dom": ROOT / "apps/demo/node_modules/react-dom",
        "@types/react": ROOT / "packages/ui/node_modules/@types/react",
    }.items():
        destination = modules / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.symlink_to(source.resolve(), target_is_directory=True)

    (consumer / "smoke.mjs").write_text('''
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { validateAdaptiveResponse } from '@adaptive-response/schema';
import { generateAdaptiveResponse, ADAPTIVE_RESPONSE_TOOL_NAME } from '@adaptive-response/core';
import { AdaptiveClient } from '@adaptive-response/sdk';
import { ResponseRenderer } from '@adaptive-response/ui';
globalThis.fetch = async () => { throw new Error('Unmocked network request in packed-consumer test'); };
const fixture = {
  decision: { mode: 'answer', confidence: 0.9, ambiguity_level: 'low', risk_level: 'low' },
  answer: { tldr: 'Packed consumer works.' },
  meta: { intent_type: 'informational', complexity_score: 2 },
};
assert.equal(validateAdaptiveResponse(fixture).answer.tldr, fixture.answer.tldr);
const generated = await generateAdaptiveResponse({ query: 'test packed engine' }, {
  apiKey: 'fixture-not-a-real-key',
  retry: {
    fetchImpl: async () => Response.json({
      content: [{ type: 'tool_use', id: 'fixture', name: ADAPTIVE_RESPONSE_TOOL_NAME, input: fixture }],
    }),
    sleep: async () => {},
  },
});
assert.equal(generated.ok, true);
const originalFetch = globalThis.fetch;
try {
  globalThis.fetch = async (url, init) => {
    assert.equal(url, 'https://fixture.invalid/v1/respond');
    assert.equal(JSON.parse(init.body).query, 'test packed client');
    return Response.json(fixture);
  };
  const response = await new AdaptiveClient({ baseUrl: 'https://fixture.invalid' })
    .respond({ query: 'test packed client' });
  const html = renderToStaticMarkup(createElement(ResponseRenderer, { data: response }));
  assert.ok(html.includes(fixture.answer.tldr));
} finally { globalThis.fetch = originalFetch; }
console.log(JSON.stringify({ node: process.version, esmImports: 4,
  engine: 'passed', sdk: 'passed', uiServerRender: 'passed' }));
''')
    print(run(["node", "smoke.mjs"], consumer).strip())
    (consumer / "consumer.ts").write_text('''
import type { AdaptiveResponse } from '@adaptive-response/schema';
import { validateAdaptiveResponse } from '@adaptive-response/schema';
import { generateAdaptiveResponse } from '@adaptive-response/core';
import { AdaptiveClient } from '@adaptive-response/sdk';
import { ResponseRenderer } from '@adaptive-response/ui';
declare const response: AdaptiveResponse;
validateAdaptiveResponse(response);
generateAdaptiveResponse({ query: 'typed' }, { apiKey: 'fixture' });
new AdaptiveClient({ baseUrl: 'https://fixture.invalid' }).respond({ query: 'typed' });
ResponseRenderer({ data: response });
''')
    run(["node", str(ROOT / "node_modules/typescript/bin/tsc"), "--noEmit", "--strict",
         "--skipLibCheck", "--module", "NodeNext", "--moduleResolution", "NodeNext",
         "--target", "ES2022", "consumer.ts"], consumer)
    print(json.dumps({"packed": packed, "declarations": "passed", "workspace_links_used": False}))
