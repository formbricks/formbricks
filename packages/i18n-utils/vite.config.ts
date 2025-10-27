/// <reference types="vitest" />
import { resolve } from "node:path";
import dts from "vite-plugin-dts";
import { PluginOption, defineConfig } from "vitest/config";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "i18nUtils",
      formats: ["es", "cjs"],
      fileName: (format) => `index.${format}.js`,
    },
    outDir: "dist",
    emptyOutDir: false,
  },
  test: {
    environment: "node",
    globals: true,
    coverage: {
      reporter: ["text", "json", "html", "lcov"],
    },
  },
  plugins: [
    dts({
      rollupTypes: false,
    }) as PluginOption,
  ],
});
