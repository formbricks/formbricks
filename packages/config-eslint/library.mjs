import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { base, commonIgnores, unusedVarsConvention } from "./base.mjs";

/*
 * Flat config for TypeScript (Node) packages — the successor of the
 * @vercel/style-guide based `library.js`. The Vercel style guide has no
 * flat-config support, so the baseline is eslint + typescript-eslint
 * recommendedTypeChecked.
 *
 * Exported as a factory: type-aware linting resolves each file against the
 * consuming package's own tsconfig, so every consumer must pass its own
 * `import.meta.dirname` as `tsconfigRootDir`.
 */
export const library = ({ tsconfigRootDir }) => [
  commonIgnores,
  // carried over from the legacy library.js ignorePatterns (declaration-file
  // coverage widened to the .d.cts/.d.mts variants)
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
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  ...base,
];

export default library;
