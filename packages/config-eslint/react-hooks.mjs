import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import { base, commonIgnores, reactCompilerRulesOptOut, typescriptParsing } from "./base.mjs";

/*
 * Flat config mirroring the old `legacy-react.js` tier: turbo + prettier +
 * react-hooks + the vitest convention, without the full react/typescript-eslint rule sets.
 * Used by packages (email, surveys) that predate the stricter tiers — move them to
 * `react.mjs` when they are ready.
 */
export const reactHooksConfig = [
  commonIgnores,
  typescriptParsing,
  // v7 exposes flat configs under `configs.flat.*`; the top-level `recommended-latest`
  // is the legacy eslintrc format and crashes ESLint 9.
  reactHooks.configs.flat.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
  reactCompilerRulesOptOut,
  ...base,
];

export default reactHooksConfig;
