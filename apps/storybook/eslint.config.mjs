import reactRefresh from "eslint-plugin-react-refresh";
import storybook from "eslint-plugin-storybook";
import react from "@formbricks/config-eslint/react";

/*
 * Storybook consumes the shared `react` tier like every other React workspace (ENG-2366). It used
 * to carry a self-contained flat config because it needed eslint-plugin-react-hooks v7 while the
 * tiers were pinned to v5; ENG-1689 moved the plugin into the pnpm catalog, so that reason is gone
 * and keeping a second config here only meant storybook silently missing rule changes made
 * everywhere else.
 *
 * Only what is genuinely storybook-specific stays local: the storybook plugin's own rules and the
 * Vite react-refresh check.
 */
export default [
  { ignores: ["storybook-static/**"] },
  ...react({ tsconfigRootDir: import.meta.dirname }),
  ...storybook.configs["flat/recommended"],
  {
    plugins: {
      "react-refresh": reactRefresh,
    },
    rules: {
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },
];
