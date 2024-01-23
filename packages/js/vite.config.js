import { resolve } from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

const config = ({ mode }) => {
  const isDevelopment = mode === "dev";
  const formbricksSurveysScriptSrc = isDevelopment
    ? "http://localhost:3003/index.umd.js"
    : "https://unpkg.com/@formbricks/surveys@^1.4.0/dist/question-date.umd.js";

  return defineConfig({
    define: {
      "import.meta.env.FORMBRICKS_SURVEYS_SCRIPT_SRC": JSON.stringify(formbricksSurveysScriptSrc),
    },
    build: {
      emptyOutDir: false, // keep the dist folder to avoid errors with pnpm go when folder is empty during build
      minify: "terser",
      sourcemap: true,
      lib: {
        // Could also be a dictionary or array of multiple entry points
        entry: resolve(__dirname, "src/index.ts"),
        name: "formbricks",
        formats: ["cjs", "es", "umd", "iife"],
        // the proper extensions will be added
        fileName: "index",
      },
    },
    plugins: [dts({ rollupTypes: true })],
  });
};

export default config;
