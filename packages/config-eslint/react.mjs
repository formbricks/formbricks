import js from "@eslint/js";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

import { base, commonIgnores, unusedVarsConvention } from "./base.mjs";

/*
 * Flat config for React component libraries — the successor of the
 * @vercel/style-guide based `react.js` (ENG-1677).
 */
export const react = [
  commonIgnores,
  js.configs.recommended,
  ...tseslint.configs.recommended,
  unusedVarsConvention,
  reactPlugin.configs.flat.recommended,
  reactPlugin.configs.flat["jsx-runtime"],
  // Accessibility rules (parity with the old @vercel/style-guide/react config; eslint-config-next
  // already provides these for the app, so this brings the react-library tier in line).
  jsxA11y.flatConfigs.recommended,
  reactHooks.configs["recommended-latest"],
  {
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    settings: {
      react: {
        version: "detect",
      },
    },
  },
  ...base,
];

export default react;
