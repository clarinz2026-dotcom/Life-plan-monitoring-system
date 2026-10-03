import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Test runner for the branch-authorization suite.
 *
 * `environment: "edge-runtime"` matches the Convex runtime the functions
 * actually execute in, and `convex-test` must be inlined so its module loader
 * works.
 *
 * Tests live outside `src/` on purpose: `tsconfig.app.json` only includes
 * `src`, so the production typecheck (`tsc -b --noEmit`) is unaffected by the
 * test-only tooling.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "src"),
    },
  },
  test: {
    environment: "edge-runtime",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    /*
     * Each test builds its own `convexTest` instance against the shared
     * `modules` map, so the database is already isolated per test. Running the
     * files in a reused worker (rather than one fresh process per file) skips
     * re-importing the whole Convex module graph four times over.
     */
    isolate: false,
    server: {
      deps: {
        inline: ["convex-test"],
      },
    },
  },
});
