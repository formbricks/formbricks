import { resolve } from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  build: {
    emptyOutDir: false, // keep the dist folder to avoid errors with pnpm go when folder is empty during build
    minify: "terser",
    sourcemap: true,
    lib: {
      // Could also be a dictionary or array of multiple entry points
      entry: resolve(__dirname, "src/index.ts"),
      name: "formbricks-api",
      formats: ["es", "umd"],
      // the proper extensions will be added
      fileName: "index",
    },
  },
  plugins: [
    dts({ rollupTypes: true }),
    nodePolyfills({
      include: ["buffer"],
      globals: {
        Buffer: true,
      },
    }),
  ],
});
