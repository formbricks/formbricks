/// <reference types="vitest" />
import { resolve } from "path";
import { defineConfig } from "vitest/config";
import type { ViteUserConfig } from "vitest/config";
import webPackageJson from "../../apps/web/package.json";
import { copyCompiledAssetsPlugin } from "../vite-plugins/copy-compiled-assets";

type VitestPluginOption = NonNullable<ViteUserConfig["plugins"]>[number];

// The bundle must run in JavaScriptCore (iOS) and bare WebView JS engines:
// no DOM, no `window`, no `self`. The UMD wrapper resolves the global via
// `globalThis`, which all target engines provide.
export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  define: {
    "import.meta.env.VERSION": JSON.stringify(webPackageJson.version),
  },
  build: {
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "formbricksMobileCore",
      formats: ["umd"],
      fileName: "core",
    },
  },
  plugins: [
    copyCompiledAssetsPlugin({
      filename: "core",
      distDir: resolve(__dirname, "dist"),
      skipDirectoryCheck: true,
      // Bridge-protocol-versioned path: a v1 native shell requests
      // /js/mobile/v1/core.umd.cjs and must always receive a v1-compatible brain.
      outputSubDir: "mobile/v1",
    }) as VitestPluginOption,
  ],
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.ts"],
      exclude: ["**/*.test.*", "**/*.spec.*"],
    },
  },
});
