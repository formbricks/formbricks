import { defineConfig } from "vitest/config";

// Dedicated test config so Vitest does not load the build-oriented vite.config.ts
// (dts/SSR/rollup input map). The unit tests here are pure and need no aliases.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
});
