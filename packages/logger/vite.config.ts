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
      entry: resolve(__dirname, "src/index.ts"),
      name: "formbricksLogger",
      fileName: "index",
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
