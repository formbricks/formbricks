import { resolve } from "path";
import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import dts from "vite-plugin-dts";
import tsconfigPaths from "vite-tsconfig-paths";

const buildPackage = "surveys";

const entryPoint = buildPackage === "surveys" ? "src/index.ts" : "src/question-date/src/index.tsx";
const name = buildPackage === "surveys" ? "formbricks-surveys" : "formbricks-question-date";
const fileName = buildPackage === "surveys" ? "index" : "question-date";

export default defineConfig({
  define: { "process.env.NODE_ENV": '"production"' },
  build: {
    emptyOutDir: false,
    minify: "terser",
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, entryPoint),
      name,
      formats: ["cjs", "es", "umd"],
      fileName,
    },
  },
  plugins: [preact(), dts({ rollupTypes: true }), tsconfigPaths()],
});
