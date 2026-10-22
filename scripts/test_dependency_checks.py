"""Regression tests for fail-closed dependency validation and SBOM provenance."""

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


def load(name):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(name + ".py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


check_versions = load("check-esbuild").check_versions
export = load("dependency-sbom").export


class EsbuildCheckTests(unittest.TestCase):
    def test_empty_graph_cannot_pass(self):
        for tree in [[], [{}], {"dependencies": {}}]:
            with self.subTest(tree=tree), self.assertRaises(ValueError):
                check_versions(tree)

    def test_empty_and_non_numeric_versions_cannot_pass(self):
        for version in ["", "unknown", "0.28.1-beta.1"]:
            with self.subTest(version=version), self.assertRaises(ValueError):
                check_versions([{"dependencies": {"esbuild": {"version": version}}}])

    def test_nested_old_copy_cannot_hide_behind_patched_copy(self):
        with self.assertRaises(ValueError):
            check_versions([{"dependencies": {
                "esbuild": {"version": "0.28.2"},
                "tool": {"dependencies": {"esbuild": {"version": "0.27.7"}}},
            }}])

    def test_checks_all_distinct_patched_versions(self):
        self.assertEqual(check_versions([{"dependencies": {
            "esbuild": {"version": "0.28.1"},
            "tool": {"dependencies": {"esbuild": {"version": "0.28.2"}}},
        }}]), ["0.28.1", "0.28.2"])


class SbomTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / "package.json").write_text(json.dumps({
            "name": "fixture", "dependencies": {"entrance": "1.0.0"},
            "devDependencies": {"test-tool": "2.0.0"},
        }))
        self.lock = """lockfileVersion: '9.0'
importers:
  .:
    dependencies:
      entrance:
        specifier: 1.0.0
        version: 1.0.0(peer@1.0.0)
    devDependencies:
      test-tool:
        specifier: 2.0.0
        version: 2.0.0
packages:
  entrance@1.0.0:
    resolution: {integrity: sha512-fixture}
  test-tool@2.0.0:
    resolution: {integrity: sha512-fixture}
  shared@3.0.0:
    resolution: {integrity: sha512-fixture}
snapshots:
  entrance@1.0.0(peer@1.0.0):
    dependencies:
      shared: 3.0.0
  test-tool@2.0.0:
    dependencies:
      shared: 3.0.0
  shared@3.0.0: {}
"""

    def write_lock(self, text=None):
        (self.root / "pnpm-lock.yaml").write_text(text or self.lock)

    def test_preserves_peer_identity_and_every_shared_carrier(self):
        self.write_lock()
        bom, summary = export(self.root)
        edges = {d["ref"]: d["dependsOn"] for d in bom["dependencies"]}
        self.assertEqual(edges["project"], ["pnpm:entrance@1.0.0(peer@1.0.0)", "pnpm:test-tool@2.0.0"])
        self.assertEqual(edges["pnpm:entrance@1.0.0(peer@1.0.0)"], ["pnpm:shared@3.0.0"])
        self.assertEqual(edges["pnpm:test-tool@2.0.0"], ["pnpm:shared@3.0.0"])
        scopes = {c["name"]: c["scope"] for c in bom["components"]}
        self.assertEqual(scopes, {"entrance": "required", "shared": "required", "test-tool": "excluded"})
        self.assertEqual(summary["unreachable_snapshots"], [])
        self.assertEqual(summary["entrance_manifests"]["entrance@1.0.0(peer@1.0.0)"], ["package.json"])

    def test_missing_transitive_target_fails(self):
        self.write_lock(self.lock.replace("shared: 3.0.0", "shared: 9.0.0"))
        with self.assertRaisesRegex(ValueError, "Unresolved dependency edges"):
            export(self.root)

    def test_unmodeled_workspace_link_fails(self):
        self.write_lock(self.lock.replace("version: 1.0.0(peer@1.0.0)", "version: link:packages/missing"))
        with self.assertRaisesRegex(ValueError, "Unmodeled workspace link"):
            export(self.root)

    def test_manifest_lock_mismatch_fails(self):
        self.write_lock()
        (self.root / "package.json").write_text('{"name":"fixture","dependencies":{}}')
        with self.assertRaisesRegex(ValueError, "Manifest/lock dependency mismatch"):
            export(self.root)

    def test_stale_unreachable_snapshot_is_counted_but_never_invented_as_an_entrance(self):
        self.write_lock(self.lock + "  stale@1.0.0: {}\n")
        bom, summary = export(self.root)
        self.assertEqual(summary["unreachable_snapshots"], ["stale@1.0.0"])
        self.assertNotIn("stale", {c["name"] for c in bom["components"]})


if __name__ == "__main__":
    unittest.main()
