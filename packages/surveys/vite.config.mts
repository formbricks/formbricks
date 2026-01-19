import preact from "@preact/preset-vite";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import dts from "vite-plugin-dts";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";
import { copyCompiledAssetsPlugin } from "../vite-plugins/copy-compiled-assets";
import { visualizer } from "rollup-plugin-visualizer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const config = ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  // Shared configuration
  const sharedConfig = {
    resolve: {
      alias: {
        // Alias React to Preact for survey-ui components
        react: "preact/compat",
        "react-dom": "preact/compat",
        "react/jsx-runtime": "preact/jsx-runtime",
      },
    },
    define: {
      "process.env.NODE_ENV": JSON.stringify(mode),
    },
    plugins: [preact(), tsconfigPaths()],
  };

  // Check if we're building the UMD bundle (separate build step)
  const isUmdBuild = process.env.BUILD_UMD === "true";

  if (isUmdBuild) {
    // UMD build for browser script tag usage (main entry only)
    return defineConfig({
      ...sharedConfig,
      build: {
        emptyOutDir: false,
        minify: "terser",
        lib: {
          entry: resolve(__dirname, "src/index.ts"),
          name: "formbricksSurveys",
          formats: ["umd"],
          fileName: () => "index.umd.cjs",
        },
        rollupOptions: {
          external: ["node-html-parser"],
        },
        outDir: "dist",
      },
    });
  }

  // Main ESM build with multiple entry points
  return defineConfig({
    ...sharedConfig,
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
    build: {
      emptyOutDir: false,
      minify: "terser",
      lib: {
        entry: {
          index: resolve(__dirname, "src/index.ts"),
          validation: resolve(__dirname, "src/lib/validation/index.ts"),
        },
        formats: ["es"],
      },
      rollupOptions: {
        // Externalize node-html-parser to keep bundle size small (~53KB)
        // It's pulled in via @formbricks/types but not used in browser runtime
        external: ["node-html-parser"],
        output: {
          entryFileNames: "[name].js",
          chunkFileNames: "assets/[name]-[hash].js",
        },
      },
      outDir: "dist",
    },
    plugins: [
      ...sharedConfig.plugins,
      dts({
        rollupTypes: true,
        // Generate separate .d.ts files for each entry point
        entryRoot: "src",
      }),
      copyCompiledAssetsPlugin({ filename: "surveys", distDir: resolve(__dirname, "dist") }),
      process.env.ANALYZE === "true" && visualizer({ filename: resolve(__dirname, "stats.html"), open: false, gzipSize: true, brotliSize: true }),
    ],
  });
};

export default config;
