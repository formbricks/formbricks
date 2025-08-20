/// <reference types="vitest" />
import { resolve } from "path";
import { PluginOption, defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "formbricksStorage",
      fileName: "index",
      formats: ["es", "cjs"],
    },
    // rollupOptions: {
    //   external: ["@aws-sdk/client-s3", "@aws-sdk/s3-presigned-post", "@aws-sdk/s3-request-presigner"],
    // },
  },
  test: {
    environment: "node",
    globals: true,
    coverage: {
      reporter: ["text", "json", "html", "lcov"],
    },
  },
  plugins: [dts({ rollupTypes: true }) as PluginOption],
});
