/// <reference types="vitest" />
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
    },
  },
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "formbricksAi",
      fileName: "index",
      formats: ["es"],
    },
    rollupOptions: {
      external: [
        "ai",
        "@ai-sdk/amazon-bedrock",
        "@ai-sdk/azure",
        "@ai-sdk/google-vertex",
        "@aws-sdk/credential-providers",
        "@formbricks/logger",
      ],
    },
    emptyOutDir: false,
  },
  test: {
    environment: "node",
    globals: true,
    coverage: {
      reporter: ["text", "json", "html", "lcov"],
    },
  },
});
