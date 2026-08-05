import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

import { base, commonIgnores, typescriptParsing } from "./base.mjs";

/*
 * Flat config mirroring the old `legacy-react.js` tier (ENG-1677): turbo + prettier +
 * react-hooks + the vitest convention, without the full react/typescript-eslint rule sets.
 * Used by packages (email, surveys) that predate the stricter tiers — move them to
 * `react.mjs` when they are ready.
 */
export const reactHooksConfig = [
  commonIgnores,
  typescriptParsing,
  reactHooks.configs["recommended-latest"],
  {
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
  ...base,
];

export default reactHooksConfig;
