import type { StorybookConfig } from "@storybook/react-vite";
import { createRequire } from "module";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import type { Plugin } from "vite";

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * This function is used to resolve the absolute path of a package.
 * It is needed in projects that use Yarn PnP or are set up within a monorepo.
 */
function getAbsolutePath(value: string): any {
  return dirname(require.resolve(join(value, "package.json")));
}

const config: StorybookConfig = {
  stories: [
    "../src/**/*.mdx",
    "../../web/modules/ui/**/stories.@(js|jsx|mjs|ts|tsx)",
    "../../../packages/survey-ui/src/**/*.stories.@(js|jsx|mjs|ts|tsx)",
  ],
  addons: [
    getAbsolutePath("@storybook/addon-onboarding"),
    getAbsolutePath("@storybook/addon-links"),
    getAbsolutePath("@chromatic-com/storybook"),
    getAbsolutePath("@storybook/addon-a11y"),
    getAbsolutePath("@storybook/addon-docs"),
  ],
  framework: {
    name: getAbsolutePath("@storybook/react-vite"),
    options: {},
  },
  async viteFinal(config) {
    const surveyUiPath = resolve(__dirname, "../../../packages/survey-ui/src");
    const webPath = resolve(__dirname, "../../web");
    const rootPath = resolve(__dirname, "../../../");

    // Configure server to allow files from outside the storybook directory
    config.server = config.server || {};
    config.server.fs = {
      ...config.server.fs,
      allow: [...(config.server.fs?.allow || []), rootPath],
    };

    // Create a more robust plugin to handle @/ alias resolution
    const aliasPlugin: Plugin = {
      name: "resolve-path-alias",
      enforce: "pre",
      resolveId(id, importer) {
        if (!id.startsWith("@/")) {
          return null;
        }

        const pathWithoutAlias = id.replace(/^@\//, "");
        const normalizedImporter = importer ? importer.replace(/\\/g, "/") : "";

        // Determine base path based on importer location
        let basePath: string | null = null;

        if (normalizedImporter.includes("packages/survey-ui")) {
          basePath = surveyUiPath;
        } else if (normalizedImporter.includes("apps/web") || normalizedImporter.includes("web/modules")) {
          basePath = webPath;
        }

        // If we can't determine from importer, try to find the file
        if (!basePath) {
          // Try survey-ui first
          const surveyUiResolved = resolve(surveyUiPath, pathWithoutAlias);
          const fs = require("fs");
          const extensions = ["", ".ts", ".tsx", ".js", ".jsx"];

          for (const ext of extensions) {
            if (fs.existsSync(surveyUiResolved + ext)) {
              return surveyUiResolved + ext;
            }
          }

          // Fall back to web
          basePath = webPath;
        }

        const resolved = resolve(basePath, pathWithoutAlias);

        // Try to resolve with extensions
        const fs = require("fs");
        const extensions = ["", ".ts", ".tsx", ".js", ".jsx"];

        for (const ext of extensions) {
          const withExt = resolved + ext;
          if (fs.existsSync(withExt)) {
            return withExt;
          }
        }

        // Return without extension - Vite will handle it
        return resolved;
      },
    };

    // Add the plugin
    config.plugins = [aliasPlugin, ...(config.plugins || [])];

    // Configure resolve options
    config.resolve = config.resolve || {};
    config.resolve.dedupe = config.resolve.dedupe || [];

    // Keep existing aliases but remove @/ since plugin handles it
    const existingAlias = config.resolve.alias || {};
    if (typeof existingAlias === "object" && !Array.isArray(existingAlias)) {
      const aliasObj = existingAlias as Record<string, string>;
      const { "@": _, ...otherAliases } = aliasObj;
      config.resolve.alias = {
        ...otherAliases,
      };
    }

    return config;
  },
};
export default config;
