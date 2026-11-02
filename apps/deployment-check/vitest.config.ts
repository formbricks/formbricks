import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    coverage: { include: ["src/**/*.ts"], exclude: ["src/**/*.test.ts"] },
  },
});
