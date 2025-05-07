import preact from "@preact/preset-vite";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { defineConfig, loadEnv } from "vite";
import dts from "vite-plugin-dts";
import tsconfigPaths from "vite-tsconfig-paths";
import { copyCompiledAssetsPlugin } from "../vite-plugins/copy-compiled-assets";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const config = ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return defineConfig({
    test: {
      environment: "node",
      environmentMatchGlobs: [["**/*.test.tsx", "jsdom"]],
      exclude: ["dist/**", "node_modules/**"],
      env: env,
      coverage: {
        provider: "v8",
        reporter: ["text", "html", "lcov"],
        reportsDirectory: "./coverage",
        include: [
          "src/lib/**/*.{ts,tsx}",
          "src/components/**/*.{ts,tsx}"
        ],
      },
    },
    define: {
      "process.env": env,
    },
    build: {
      emptyOutDir: false,
      minify: "terser",
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
        },
      },
      lib: {
        entry: resolve(__dirname, "src/index.ts"),
        name: "formbricksSurveys",
        formats: ["es", "umd"],
        fileName: "index",
      },
    },
    plugins: [
      preact(),
      dts({ rollupTypes: true }),
      tsconfigPaths(),
      copyCompiledAssetsPlugin({ filename: "surveys", distDir: resolve(__dirname, "dist") }),
    ],
  });
};

export default config;