import js from "@eslint/js";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";
import { base, commonIgnores, unusedVarsConvention } from "./base.mjs";

/*
 * Flat config for React component libraries — the successor of the
 * @vercel/style-guide based `react.js`, with the same type-aware
 * typescript-eslint baseline as the library tier.
 *
 * Exported as a factory: consumers must pass their own `import.meta.dirname`
 * as `tsconfigRootDir` so type-aware rules resolve against the right tsconfig.
 */
export const react = ({ tsconfigRootDir }) => [
  commonIgnores,
  // Config files (tailwind.config.ts, vite.config.mts, ...) sit outside the package
  // tsconfigs; ignore them like the library tier does so type-aware linting can't
  // hard-error on them. Declaration files are generated, not authored.
  { ignores: ["**/*.config.{js,cjs,mjs,ts,mts}", "**/*.d.{ts,cts,mts}"] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir,
      },
    },
    rules: {
      // from strictTypeChecked (adopted individually, not the whole strict tier)
      "@typescript-eslint/no-unnecessary-condition": "error",
    },
  },
  // Plain JS files (scripts, .cjs/.mjs configs) live outside the tsconfigs; without
  // this block the type-aware rules hard-error on them.
  { files: ["**/*.{js,cjs,mjs}"], ...tseslint.configs.disableTypeChecked },
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
