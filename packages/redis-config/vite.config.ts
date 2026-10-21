import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(import.meta.dirname, "src/index.ts"),
      formats: ["es", "cjs"],
      fileName: "index",
    },
    rollupOptions: { external: ["node:crypto"] },
  },
  test: {
    environment: "node",
    coverage: { reporter: ["text", "json", "html", "lcov"] },
  },
});
