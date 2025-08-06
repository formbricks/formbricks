import { resolve } from "path";
import { UserConfig, defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig((): UserConfig => {
  return {
    resolve: {
      alias: {
        "@": resolve(__dirname, "src"),
      },
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, "src/index.ts"),
        },
        output: [
          {
            format: "esm",
            entryFileNames: "[name].js",
            chunkFileNames: "[name].js",
          },
          {
            format: "cjs",
            entryFileNames: "[name].cjs",
            chunkFileNames: "[name].cjs",
          },
        ],
        external: [
          // External dependencies that should not be bundled
          "@ai-sdk/anthropic",
          "@ai-sdk/openai",
          "ai",
          "zod",
        ],
      },
      emptyOutDir: true,
      ssr: true, // Server-side rendering mode for Node.js
    },
    plugins: [
      dts({
        rollupTypes: false,
        include: ["src/**/*"],
        exclude: ["src/**/*.test.ts", "src/**/*.spec.ts"],
        insertTypesEntry: true,
      }),
    ],
  };
});
