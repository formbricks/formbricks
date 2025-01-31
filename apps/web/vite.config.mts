import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["playwright/**", "node_modules/**"],
    setupFiles: ["../../packages/lib/vitestSetup.ts"],
    coverage: {
      reporter: ["text", "lcov"],
      reportsDirectory: "./coverage",
    },
  },
  plugins: [tsconfigPaths()],
});
