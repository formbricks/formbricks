/// <reference types="vitest" />
import { resolve } from "path";
import dts from "vite-plugin-dts";
import { defineConfig } from "vitest/config";
import type { ViteUserConfig } from "vitest/config";
import webPackageJson from "../../apps/web/package.json";
import { copyCompiledAssetsPlugin } from "../vite-plugins/copy-compiled-assets";
import { rewriteNodeNextDtsSpecifiers } from "../vite-plugins/node-next-dts";

type VitestPluginOption = NonNullable<ViteUserConfig["plugins"]>[number];

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
    emptyOutDir: false, // keep the dist folder to avoid errors with pnpm go when folder is empty during build
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "formbricks",
      formats: ["umd"],
      fileName: "index",
    },
  },
  plugins: [
    dts({
      rollupTypes: false,
      insertTypesEntry: true,
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/**/*.spec.ts", "src/**/tests/**", "vitest.setup.ts"],
      beforeWriteFile: rewriteNodeNextDtsSpecifiers,
    }) as VitestPluginOption,
    copyCompiledAssetsPlugin({
      filename: "formbricks",
      distDir: resolve(__dirname, "dist"),
      skipDirectoryCheck: true, // Skip checking for subdirectories that might not exist
    }) as VitestPluginOption,
  ],
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: ["src/lib/**/*.ts"],
      exclude: ["src/lib/**/*.mock.ts", "vitest.setup.ts", "**/*.test.*", "**/*.spec.*"],
    },
  },
});
