/// <reference types="vitest" />
import { resolve } from "path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "formbricksCache",
      fileName: "index",
      formats: ["es", "cjs"],
    },
    rollupOptions: {
      external: ["redis", "@formbricks/logger"],
    },
  },
  test: {
    environment: "node",
    globals: true,
    coverage: {
      reporter: ["text", "json", "html"],
    },
  },
});
