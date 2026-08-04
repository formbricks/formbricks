import preact from "@preact/preset-vite";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv, type Plugin } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";
import { copyCompiledAssetsPlugin } from "../vite-plugins/copy-compiled-assets";
import { visualizer } from "rollup-plugin-visualizer";

// Stubs the @formbricks/survey-ui/styles?inline import during vitest runs so that
// tests do not require packages/survey-ui to be built first. The plugin only
// activates when VITEST is set, leaving production builds untouched.
const stubSurveyUiStylesForVitest = (): Plugin => {
  const stubId = "\0virtual:survey-ui-styles-stub";
  return {
    name: "formbricks:stub-survey-ui-styles-in-tests",
    enforce: "pre",
    apply() {
      return process.env.VITEST === "true";
    },
    resolveId(source) {
      if (source === "@formbricks/survey-ui/styles?inline") {
        return stubId;
      }
      return null;
    },
    load(id) {
      if (id === stubId) {
        return 'export default "";';
      }
      return null;
    },
  };
};

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
      plugins: [
        ...sharedConfig.plugins,
        copyCompiledAssetsPlugin({ filename: "surveys", distDir: resolve(__dirname, "dist") }),
      ],
    });
  }

  // Main ESM build with multiple entry points
  return defineConfig({
    ...sharedConfig,
    test: {
      setupFiles: ["./vitestSetup.ts"],
      exclude: ["dist/**", "node_modules/**"],
      env: env,
      // Environment selection (ENG-1680): Vitest 4 removed `environmentMatchGlobs`, so environments
      // are assigned via projects. *.test.tsx (component tests) run in happy-dom automatically;
      // *.test.ts default to node — the few DOM-dependent .ts tests keep their per-file
      // `@vitest-environment happy-dom` pragma.
      projects: [
        {
          extends: true,
          test: {
            name: "surveys-unit",
            environment: "node",
            include: ["**/*.test.ts"],
            exclude: ["dist/**", "node_modules/**"],
          },
        },
        {
          extends: true,
          test: {
            name: "surveys-components",
            environment: "happy-dom",
            include: ["**/*.test.tsx"],
            exclude: ["dist/**", "node_modules/**"],
          },
        },
      ],
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
      lib: {
        entry: {
          index: resolve(__dirname, "src/index.ts"),
          validation: resolve(__dirname, "src/validation.ts"),
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
      stubSurveyUiStylesForVitest(),
      copyCompiledAssetsPlugin({ filename: "surveys", distDir: resolve(__dirname, "dist") }),
      process.env.ANALYZE === "true" && visualizer({ filename: resolve(__dirname, "stats.html"), open: false, gzipSize: true, brotliSize: true }),
    ],
  });
};

export default config;
