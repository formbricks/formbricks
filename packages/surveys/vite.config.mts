import preact from "@preact/preset-vite";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import type { Plugin } from "vite";
import { loadEnv } from "vite";
import dts from "vite-plugin-dts";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";
import { copyCompiledAssetsPlugin } from "../vite-plugins/copy-compiled-assets";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Vite plugin that intercepts ui package's cn utility import
 * and replaces it with our prefixed version
 */
function addFbPrefixPlugin(): Plugin {
  const uiUtilsPath = resolve(__dirname, "../ui/src/lib/utils.ts");
  const embedCnPath = resolve(__dirname, "src/lib/cn-with-prefix.ts");
  const uiSrcPath = resolve(__dirname, "../ui/src");

  return {
    name: "add-fb-prefix-to-ui",
    enforce: "pre",
    resolveId(id, importer) {
      if (!importer) return null;

      // Normalize paths for comparison
      const normalizedImporter = importer.replace(/\\/g, "/");
      const normalizedUiSrc = uiSrcPath.replace(/\\/g, "/");

      // Check if the importer is from ui package
      const isFromUi =
        normalizedImporter.includes("ui/src") ||
        normalizedImporter.includes("ui\\src") ||
        normalizedImporter.startsWith(normalizedUiSrc) ||
        normalizedImporter.includes("/ui/") ||
        normalizedImporter.includes("\\ui\\");

      if (isFromUi) {
        // Handle @/lib/utils alias
        if (id === "@/lib/utils" || id === "@/lib/utils.ts") {
          return embedCnPath;
        }

        // Handle relative imports like "../../lib/utils" or "../lib/utils"
        if (id.includes("lib/utils")) {
          try {
            const resolved = resolve(dirname(importer), id);
            const normalizedResolved = resolved.replace(/\\/g, "/");
            const normalizedTarget = uiUtilsPath.replace(/\\/g, "/");

            if (normalizedResolved === normalizedTarget) {
              return embedCnPath;
            }
          } catch {
            // Ignore resolution errors
          }
        }
      }

      // Also intercept direct imports of ui package's utils file
      const normalizedId = id.replace(/\\/g, "/");
      const normalizedTarget = uiUtilsPath.replace(/\\/g, "/");
      if (normalizedId === normalizedTarget) {
        return embedCnPath;
      }

      return null;
    },
    load(id) {
      // Intercept when the actual utils file is loaded
      const normalizedId = id.replace(/\\/g, "/");
      const normalizedTarget = surveyCoreUtilsPath.replace(/\\/g, "/");

      if (normalizedId === normalizedTarget) {
        // Return our prefixed version - use relative path from embed
        const relativePath = embedCnPath.replace(/\\/g, "/");
        return `export { cn } from "${relativePath}";`;
      }
      return null;
    },
  };
}

const config = ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return defineConfig({
    test: {
      environment: "node",
      environmentMatchGlobs: [
        ["**/*.test.tsx", "jsdom"],
        ["**/lib/**/*.test.ts", "jsdom"],
      ],
      setupFiles: ["./vitestSetup.ts"],
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
      addFbPrefixPlugin(),
      dts({ rollupTypes: true }),
      tsconfigPaths(),
      copyCompiledAssetsPlugin({ filename: "surveys", distDir: resolve(__dirname, "dist") }),
    ],
    resolve: {
      alias: {
        // Alias React to Preact for ui package components
        react: "preact/compat",
        "react-dom": "preact/compat",
        "react/jsx-runtime": "preact/jsx-runtime",
        // Allow importing from ui package source files
        "@formbricks/ui/src": resolve(__dirname, "../../ui/src"),
      },
    },
  });
};

export default config;
