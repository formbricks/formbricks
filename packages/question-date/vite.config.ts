import { resolve } from "path";
import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

export default defineConfig({
  define: { "process.env.NODE_ENV": '"production"' },
  build: {
    minify: "terser",
    lib: {
      entry: resolve(__dirname, "src/index.tsx"),
      name: "QuestionDate",
      fileName: "index",
      formats: ["cjs", "es", "umd"],
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
