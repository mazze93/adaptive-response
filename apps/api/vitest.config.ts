import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// The Worker's testable surface is web-standard (Request, Response, URL,
// crypto.randomUUID, global fetch). We call `worker.fetch(request, env)`
// directly with a hand-built env, injecting a fake RATE_LIMITER and stubbing
// global fetch — no workerd runtime needed. Plain Node environment (matches
// the schema package's setup).
//
// @adaptive/schema is aliased to its source so these tests run against a clean
// checkout with no prior build step (the package normally resolves to dist/).
// Still an import of "@adaptive/schema" — just resolved to source at runtime.
export default defineConfig({
  resolve: {
    alias: {
      "@adaptive/schema": fileURLToPath(
        new URL("../../packages/schema/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
