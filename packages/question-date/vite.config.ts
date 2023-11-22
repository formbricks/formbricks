import { resolve } from "path";
import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

export default defineConfig({
  build: {
    minify: "terser",
    rollupOptions: {
      input: {
        main: resolve(__dirname, "src/index.tsx"),
      },
      output: {
        entryFileNames: "index.js",
        globals: {
          preact: "preact",
        },
      },
    },
  },
  plugins: [preact()],
  resolve: {
    alias: {
      react: "preact/compat",
      "react-dom": "preact/compat",
    },
  },
});
