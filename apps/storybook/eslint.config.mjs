import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import storybook from "eslint-plugin-storybook";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  { ignores: ["dist/**", "node_modules/**", "storybook-static/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // eslint-plugin-react-hooks v7 exposes flat configs under `configs.flat.*`;
  // the top-level `recommended-latest` is the legacy (eslintrc) format and crashes ESLint 9.
  reactHooks.configs.flat.recommended,
  ...storybook.configs["flat/recommended"],
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2020,
      },
    },
    plugins: {
      "react-refresh": reactRefresh,
    },
    rules: {
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },
];
