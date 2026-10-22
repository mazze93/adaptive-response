#!/usr/bin/env python3
"""Fail closed unless every resolved esbuild version is at least 0.28.1."""

import json
import re
import subprocess


def check_versions(tree):
    versions = set()

    def visit(node):
        if isinstance(node, list):
            for value in node:
                visit(value)
        elif isinstance(node, dict):
            for name, value in node.items():
                if name == "esbuild" and isinstance(value, dict):
                    versions.add(value.get("version", ""))
                visit(value)

    visit(tree)
    if not versions:
        raise ValueError("No resolved esbuild versions found; refusing to report success")
    for version in versions:
        if not re.fullmatch(r"\d+\.\d+\.\d+", version):
            raise ValueError(f"Unrecognized esbuild version: {version!r}")
        if tuple(map(int, version.split("."))) < (0, 28, 1):
            raise ValueError(f"Unpatched esbuild version: {version}; require >=0.28.1")
    return sorted(versions)


if __name__ == "__main__":
    result = subprocess.run(
        ["pnpm", "-r", "list", "esbuild", "--depth=Infinity", "--json"],
        capture_output=True, text=True, check=True,
    )
    try:
        print("Verified esbuild versions: " + ", ".join(check_versions(json.loads(result.stdout))))
    except (ValueError, TypeError) as error:
        raise SystemExit(str(error)) from error
