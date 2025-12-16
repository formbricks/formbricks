import preact from "@preact/preset-vite";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { loadEnv } from "vite";
import dts from "vite-plugin-dts";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";
import { copyCompiledAssetsPlugin } from "../vite-plugins/copy-compiled-assets";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const config = ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return defineConfig({
    resolve: {
      alias: {
        // Alias React to Preact for survey-ui components
        react: "preact/compat",
        "react-dom": "preact/compat",
        "react/jsx-runtime": "preact/jsx-runtime",
      },
    },
    test: {
      name: "surveys",
      environment: "node",
      environmentMatchGlobs: [
        ["**/*.test.tsx", "jsdom"],
        ["**/lib/**/*.test.ts", "jsdom"],
      ],
      setupFiles: ["./vitestSetup.ts"],
      include: ["**/*.test.ts", "**/*.test.tsx"],
      exclude: ["dist/**", "node_modules/**"],
      env: env,
      coverage: {
        provider: "v8",
        reporter: ["text", "html", "lcov"],
        reportsDirectory: "./coverage",
        include: ["src/lib/**/*.ts"],
        exclude: ["**/*.tsx"],
      },
    },
    define: {
      "process.env.NODE_ENV": JSON.stringify(mode),
    },
    build: {
      emptyOutDir: false,
      minify: "terser",
      rollupOptions: {
        // Externalize node-html-parser to keep bundle size small (~53KB)
        // It's pulled in via @formbricks/types but not used in browser runtime
        external: ["node-html-parser"],
        input: resolve(__dirname, "src/index.ts"),
        output: [
          {
            format: "es",
            entryFileNames: "index.js",
            chunkFileNames: "assets/[name]-[hash].js",
            inlineDynamicImports: false,
          },
          {
            format: "umd",
            name: "formbricksSurveys",
            entryFileNames: "index.umd.cjs",
            inlineDynamicImports: true,
          },
        ],
      },
      outDir: "dist"
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
