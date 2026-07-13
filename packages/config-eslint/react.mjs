import js from "@eslint/js";
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
