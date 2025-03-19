import { resolve } from "node:path";
import { defineConfig } from "vite";

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
    sourcemap: true,
    emptyOutDir: false,
  },
});
