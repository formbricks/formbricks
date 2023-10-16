import { resolve } from "path";
import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

export default defineConfig({
  build: {
    minify: "terser",
    lib: {
      // Could also be a dictionary or array of multiple entry points
      entry: resolve(__dirname, "src/main.tsx"),
      name: "QuestionDate",
      // the proper extensions will be added
      fileName: "index",
    },
    cssCodeSplit: false,
  },
  plugins: [preact()],
});
