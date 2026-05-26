/// <reference types="vitest" />
import { resolve } from "path";
import dts from "vite-plugin-dts";
import { defineConfig } from "vitest/config";
import { rewriteNodeNextDtsSpecifiers } from "../vite-plugins/node-next-dts";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
    },
  },
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "formbricksCache",
      fileName: "index",
      formats: ["es", "cjs"],
    },
    rollupOptions: {
      external: ["redis", "@formbricks/logger", "zod"],
    },
  },
  plugins: [
    dts({
      include: ["src/**/*", "types/**/*"],
      entryRoot: ".",
      outDir: "dist",
      beforeWriteFile: rewriteNodeNextDtsSpecifiers,
    }),
  ],
  test: {
    environment: "node",
    globals: true,
    coverage: {
      reporter: ["text", "json", "html", "lcov"],
    },
  },
});
