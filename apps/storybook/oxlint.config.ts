import { fileURLToPath } from "node:url";
import { defineConfig } from "oxlint";
import { compose, denyWarnings } from "@formbricks/config-oxlint/base";
import react from "@formbricks/config-oxlint/react";

/*
 * Storybook consumes the shared `react` tier like every other React workspace (ENG-2366). Only what
 * is genuinely storybook-specific stays local: the storybook plugin's own rules (as a JS plugin) and
 * the Vite react-refresh check, which oxlint implements natively as `react/only-export-components`.
 */
const storybookRecommended = {
  // eslint-plugin-storybook 10.6 `flat/recommended`, for story files.
  stories: {
    "react/rules-of-hooks": "off",
    "storybook/await-interactions": "error",
    "storybook/context-in-play-function": "error",
    "storybook/default-exports": "error",
    "storybook/hierarchy-separator": "warn",
    "storybook/no-redundant-story-name": "warn",
    "storybook/no-renderer-packages": "error",
    "storybook/prefer-pascal-case": "warn",
    "storybook/story-exports": "error",
    "storybook/use-storybook-expect": "error",
    "storybook/use-storybook-testing-library": "error",
  },
  // ... and for the Storybook main config.
  main: { "storybook/no-uninstalled-addons": "error" },
} as const;

// Storybook stays warning-free (its ESLint script ran with `--max-warnings 0`). Its warnings are raised
// to errors here, so the repo-wide `pnpm lint:code` fails on them too; `pnpm lint:storybook` (part of
// `pnpm lint`) additionally fails on stale disable directives, which oxlint only reports repo-wide.
export default defineConfig(
  denyWarnings(
    compose({ ignorePatterns: ["storybook-static/**"] }, react, {
      jsPlugins: [
        { name: "storybook", specifier: fileURLToPath(import.meta.resolve("eslint-plugin-storybook")) },
      ],
      rules: {
        "react/only-export-components": ["warn", { allowConstantExport: true }],
      },
      overrides: [
        {
          files: ["**/*.stories.{ts,tsx,js,jsx,mjs,cjs}", "**/*.story.{ts,tsx,js,jsx,mjs,cjs}"],
          rules: storybookRecommended.stories,
        },
        { files: [".storybook/main.{js,cjs,mjs,ts}"], rules: storybookRecommended.main },
      ],
    })
  )
);
