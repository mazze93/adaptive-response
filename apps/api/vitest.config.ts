import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// The Worker's testable surface is web-standard (Request, Response, URL,
// crypto.randomUUID, global fetch). We call `worker.fetch(request, env)`
// directly with a hand-built env, injecting a fake RATE_LIMITER and stubbing
// global fetch — no workerd runtime needed. Plain Node environment (matches
// the schema package's setup).
//
// Workspace packages are aliased to their sources so these tests run against a
// clean checkout with no prior build step (they normally resolve to dist/).
export default defineConfig({
  resolve: {
    alias: {
      "@adaptive-response/core": fileURLToPath(
        new URL("../../packages/core/src/index.ts", import.meta.url),
      ),
      "@adaptive-response/schema": fileURLToPath(
        new URL("../../packages/schema/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
