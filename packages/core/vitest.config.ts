import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// @adaptive/schema is aliased to its source so these tests run against a clean
// checkout with no prior build step (the package normally resolves to dist/).
export default defineConfig({
  resolve: {
    alias: {
      "@adaptive/schema": fileURLToPath(new URL("../schema/src/index.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
