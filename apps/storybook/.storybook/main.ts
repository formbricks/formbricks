import type { StorybookConfig } from "@storybook/react-vite";
import { createRequire } from "module";
import { dirname, join } from "path";
import { mergeConfig } from "vite";

const require = createRequire(import.meta.url);

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
    "../../../packages/surveys/src/components/**/stories.@(js|jsx|mjs|ts|tsx)",
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
    return mergeConfig(config, {
      resolve: {
        alias: {
          preact: "react",
          "preact/hooks": "react",
          "preact/jsx-runtime": "react/jsx-runtime",
        },
      },
    });
  },
};
export default config;
