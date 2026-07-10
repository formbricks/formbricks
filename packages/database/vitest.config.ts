/// <reference types="vitest" />
import { defineConfig } from "vitest/config";

// Standalone from the build `vite.config.ts` (which is async and carries the dts/ssr/rollup wiring)
// so the test run stays pure. Tests here must not require a database or any env — they exercise
// pure error-shape logic only.
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts"],
  },
});
