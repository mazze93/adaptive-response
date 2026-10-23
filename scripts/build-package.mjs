import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const name = process.argv[2];
if (!["schema", "core", "sdk", "ui"].includes(name)) {
  console.error("Expected a library name: schema, core, sdk, or ui");
  process.exit(1);
}

const directory = join(root, "packages", name);
// Only this library's generated output is removed. Deleted/renamed modules
// must not survive a rebuild and ship in the package's dist-only tarball.
rmSync(join(directory, "dist"), { recursive: true, force: true });
const result = spawnSync(
  process.execPath,
  [join(root, "node_modules/typescript/bin/tsc"), "-p", "tsconfig.build.json"],
  { cwd: directory, stdio: "inherit" },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
