import { resolve } from "node:path";
import { PluginOption, defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "formbricksLogger",
      fileName: "index",
      formats: ["es", "cjs"],
    },
    rollupOptions: {
      external: ["pino", "pino-pretty", "zod"],
      output: {
        exports: "named",
        globals: {
          pino: "pino",
          "pino-pretty": "pinoPretty",
          zod: "zod",
        },
      },
    },
    emptyOutDir: false,
  },
  plugins: [
    dts({
      rollupTypes: true,
    }) as PluginOption,
  ],
});
