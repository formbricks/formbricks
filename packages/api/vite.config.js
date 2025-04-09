import { resolve } from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  build: {
    emptyOutDir: false, // keep the dist folder to avoid errors with pnpm go when folder is empty during build
    minify: "terser",
    lib: {
      // Could also be a dictionary or array of multiple entry points
      entry: resolve(__dirname, "src/index.ts"),
      name: "formbricks-api",
      formats: ["es", "umd"],
      // the proper extensions will be added
      fileName: "index",
    },
  },
  plugins: [dts({ rollupTypes: true })],
});
