import { resolve } from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  build: {
    lib: {
      // Could also be a dictionary or array of multiple entry points
      entry: resolve(__dirname, "src/index.ts"),
      name: "formbricks-js",
      formats: ["cjs", "es", "umd"],
      // the proper extensions will be added
      fileName: "index",
    },
  },
  plugins: [dts({ rollupTypes: true })],
});
