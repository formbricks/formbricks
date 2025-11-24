import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineWorkspace } from "vitest/config";

const dirname = typeof __dirname !== "undefined" ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default [
  "packages/*/vite.config.{ts,mts}",
  "apps/**/vite.config.{ts,mts}",
  {
    extends: "packages/surveys/vite.config.mts",
    plugins: [
      // The plugin will run tests for the stories defined in your Storybook config
      // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      storybookTest({
        configDir: path.join(dirname, ".storybook"),
      }),
    ],
    test: {
      name: "storybook",
      browser: {
        enabled: true,
        headless: true,
        provider: "playwright",
        instances: [
          {
            browser: "chromium",
          },
        ],
      },
      setupFiles: ["packages/surveys/.storybook/vitest.setup.ts"],
    },
  },
];
