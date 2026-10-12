/// <reference types="vitest" />
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
    coverage: {
      // lcov is what SonarCloud reads (sonar.javascript.lcov.reportPaths).
      reporter: ["text", "json", "html", "lcov"],
      include: ["src/**/*.ts", "scripts/**/*.ts"],
      exclude: ["src/generated/**", "**/*.test.ts"],
    },
  },
});
