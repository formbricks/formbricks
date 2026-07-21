import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  build: {
    copyPublicDir: false,
    emptyOutDir: true,
    outDir: "dist/docker",
    ssr: "scripts/docker/validate-env.ts",
    target: "node24",
    rollupOptions: {
      output: {
        entryFileNames: "validate-env.mjs",
      },
    },
  },
  ssr: {
    noExternal: true,
  },
});
