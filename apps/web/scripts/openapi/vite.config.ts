import { resolve } from "node:path";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "../../modules/api/v2/openapi-document.ts"),
      name: "openapiDocument",
      fileName: "openapi-document",
      formats: ["cjs"],
    },
    rollupOptions: {
      external: ["@prisma/client", "yaml", "zod", "zod-openapi"],
      output: {
        exports: "named",
      },
    },
    outDir: "dist",
    emptyOutDir: false,
  },
  plugins: [tsconfigPaths()],
});
