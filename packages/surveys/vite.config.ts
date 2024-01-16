import preact from "@preact/preset-vite";
import { resolve } from "path";
import { defineConfig, loadEnv } from "vite";
import dts from "vite-plugin-dts";
import tsconfigPaths from "vite-tsconfig-paths";

const buildPackage = process.env.SURVEYS_PACKAGE_BUILD || "surveys";

const entryPoint = buildPackage === "surveys" ? "src/index.ts" : "src/sideload/question-date/index.tsx";
const name = buildPackage === "surveys" ? "formbricks-surveys" : "formbricks-question-date";
const fileName = buildPackage === "surveys" ? "index" : "question-date";

const config = ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  const isDevelopment = mode === "dev";
  const datePickerScriptSrc = isDevelopment
    ? "http://localhost:3003/question-date.umd.js"
    : "https://unpkg.com/@formbricks/surveys@^1.4.0/dist/question-date.umd.js";

  return defineConfig({
    define: {
      "process.env": env,
      "import.meta.env.DATE_PICKER_SCRIPT_SRC": JSON.stringify(datePickerScriptSrc),
    },
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
};

export default config;
