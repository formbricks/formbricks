import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const canonicalSchema = readFileSync(new URL("../../authzed/schema.zed", import.meta.url), "utf8");

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    {
      name: "bundle-authzed-schema",
      generateBundle() {
        this.emitFile({ fileName: "schema.zed", source: canonicalSchema, type: "asset" });
      },
    },
  ],
  resolve: {
    alias: {
      "server-only": fileURLToPath(new URL("./scripts/docker/server-only-empty.ts", import.meta.url)),
    },
  },
  build: {
    copyPublicDir: false,
    emptyOutDir: true,
    outDir: "dist/authzed-cli",
    ssr: "scripts/docker/authzed-cli.ts",
    target: "node24",
    rollupOptions: {
      output: {
        chunkFileNames: "chunks/[name]-[hash].mjs",
        entryFileNames: "index.mjs",
      },
    },
  },
  ssr: {
    noExternal: true,
  },
});
