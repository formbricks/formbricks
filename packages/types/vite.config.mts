import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/integrations/**", "**/dist/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      reportsDirectory: "./coverage",
      include: [
        "**/*.ts",
        "!**/*.test.ts",
        "!**/node_modules/**",
        "!**/vitest.config.ts"
      ]
    },
  },
  plugins: [tsconfigPaths()],
});
