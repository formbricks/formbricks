import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      reporter: ["text", "json", "html", "lcov"],
    },
  },
  build: {
    lib: {
      // loggable-error is its own entry so tests that mock the logger (the main entry) keep the real helper.
      entry: {
        index: resolve(__dirname, "src/index.ts"),
        "loggable-error": resolve(__dirname, "src/loggable-error.ts"),
      },
      name: "formbricksLogger",
      fileName: (format, entryName) => `${entryName}.${format === "es" ? "js" : "cjs"}`,
      formats: ["es", "cjs"],
    },
    rollupOptions: {
      external: ["pino", "pino-pretty", "pino-opentelemetry-transport", "zod"],
      output: {
        exports: "named",
        globals: {
          pino: "pino",
          "pino-pretty": "pinoPretty",
          zod: "zod",
        },
      },
    },
    emptyOutDir: false,
  },
});
