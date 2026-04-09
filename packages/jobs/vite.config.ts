/// <reference types="vitest" />
import { resolve } from "path";
import dts from "vite-plugin-dts";
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
      name: "formbricksJobs",
      fileName: "index",
      formats: ["es", "cjs"],
    },
    rollupOptions: {
      external: ["@formbricks/logger", "bullmq", "ioredis", "zod"],
    },
  },
  test: {
    environment: "node",
    globals: true,
    coverage: {
      exclude: ["src/index.ts"],
      reporter: ["text", "json", "html", "lcov"],
    },
  },
  plugins: [
    dts({
      include: ["src/**/*"],
      exclude: ["src/**/*.test.ts"],
      entryRoot: "src",
      outDir: "dist",
    }),
  ],
});
