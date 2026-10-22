#!/usr/bin/env python3
"""Export pnpm v9's resolved workspace graph for Theatre, without dependencies.

Reads only the documented importer/snapshot mappings, not arbitrary YAML.
Fails on unresolved edges or unsupported references instead of inventing roots.
Workspace members fold into one project, matching Theatre's npm-workspace model.
Package metadata (all OS/CPU builds) is counted separately from resolved snapshots.
"""

import argparse
import hashlib
import json
import re
from collections import defaultdict
from pathlib import Path
from urllib.parse import quote


def unquote(value):
    return value.strip().strip("'\"")


def export(root):
    text = (root / "pnpm-lock.yaml").read_text()
    if not text.startswith("lockfileVersion: '9.0'"):
        raise ValueError("Only pnpm lockfile version 9.0 is supported")
    section = key = group = dependency = None
    importers = defaultdict(lambda: defaultdict(dict))
    snapshots = {}
    packages = []
    for line in text.splitlines():
        if line and not line[0].isspace():
            section = line.rstrip(":")
        match = re.fullmatch(r"  (\S.*?):(?: \{\})?", line)
        if match:
            key = unquote(match[1])
            group = dependency = None
            if section == "packages":
                packages.append(key)
            elif section == "snapshots":
                snapshots[key] = []
            continue
        if section not in ("importers", "snapshots"):
            continue
        match = re.fullmatch(r"    (\w+):", line)
        if match:
            group = match[1]
            continue
        if group not in ("dependencies", "devDependencies", "optionalDependencies"):
            continue
        if section == "importers":
            match = re.fullmatch(r"      (\S.*?):", line)
            if match:
                dependency = unquote(match[1])
            match = re.fullmatch(r"        version: (.+)", line)
            if match:
                if dependency is None:
                    raise ValueError(f"Version without dependency: {line}")
                importers[key][group][dependency] = unquote(match[1])
        else:
            match = re.fullmatch(r"      (\S.*?): (.+)", line)
            if match:
                snapshots[key].append(f"{unquote(match[1])}@{unquote(match[2])}")
    if not importers or not snapshots or not packages:
        raise ValueError("Missing importer, snapshot, or package section")
    manifests = {}
    roots = set()
    prod_roots = set()
    for importer, groups in importers.items():
        manifest = root / importer / "package.json"
        doc = json.loads(manifest.read_text())
        manifests[importer] = doc
        for group, deps in groups.items():
            if set(deps) != set(doc.get(group, {})):
                raise ValueError(f"Manifest/lock dependency mismatch: {manifest} {group}")
            for name, version in deps.items():
                if version.startswith("link:"):
                    target = (root / importer / version[5:]).resolve()
                    if target not in {(root / p).resolve() for p in importers}:
                        raise ValueError(f"Unmodeled workspace link: {importer} {version}")
                    continue
                ref = f"{name}@{version}"
                roots.add(ref)
                if group != "devDependencies":
                    prod_roots.add(ref)
    unresolved = [(parent, child) for parent, children in snapshots.items()
                  for child in children if child not in snapshots]
    unresolved += [("project", child) for child in roots if child not in snapshots]
    if unresolved:
        raise ValueError(f"Unresolved dependency edges: {unresolved}")

    def reachable(starts):
        seen, todo = set(), list(starts)
        while todo:
            ref = todo.pop()
            if ref not in seen:
                seen.add(ref)
                todo.extend(snapshots[ref])
        return seen

    reached, production = reachable(roots), reachable(prod_roots)
    components = []
    for ref in sorted(reached):
        base = ref.split("(", 1)[0]
        name, version = base.rsplit("@", 1)
        components.append({"type": "library", "bom-ref": f"pnpm:{ref}",
                           "name": name, "version": version,
                           "purl": f"pkg:npm/{quote(name, safe='/')}@{version}",
                           "scope": "required" if ref in production else "excluded"})
    bom = {"bomFormat": "CycloneDX", "specVersion": "1.5", "version": 1,
           "metadata": {"component": {"type": "application", "bom-ref": "project",
                                       "name": manifests["."]["name"]}},
           "components": components,
           "dependencies": [{"ref": "project", "dependsOn": [f"pnpm:{r}" for r in sorted(roots)]}]
           + [{"ref": f"pnpm:{r}", "dependsOn": [f"pnpm:{c}" for c in sorted(set(snapshots[r]))]}
              for r in sorted(reached)]}
    summary = {"lockfile_sha256": hashlib.sha256(text.encode()).hexdigest(),
               "workspace_manifests": sorted(importers),
               "package_version_records": len(packages),
               "unique_package_names": len({r.rsplit("@", 1)[0] for r in packages}),
               "resolved_snapshots": len(snapshots), "reachable_snapshots": len(reached),
               "unreachable_snapshots": sorted(set(snapshots) - reached),
               "production_reachable_snapshots_including_optional": len(production),
               "direct_entrances": len(roots),
               "entrance_manifests": {r: [f"{p}/package.json" if p != "." else "package.json"
                                         for p, groups in importers.items()
                                         if any(f"{n}@{v}" == r for d in groups.values() for n, v in d.items())]
                                      for r in sorted(roots)},
               "subtrees_package_versions_including_optional": {
                   r.split("(", 1)[0]: len({v.split("(", 1)[0] for v in reachable([r])})
                   for r in sorted(roots)}}
    return bom, summary


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    bom, summary = export(args.root.resolve())
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / "sbom.json").write_text(json.dumps(bom, indent=2) + "\n")
    (args.output / "graph-summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    print(json.dumps({k: v for k, v in summary.items() if k != "entrance_manifests"}, indent=2))
