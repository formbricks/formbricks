import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

import { base, commonIgnores, unusedVarsConvention } from "./base.mjs";

/*
 * Flat config for TypeScript (Node) packages — the successor of the
 * @vercel/style-guide based `library.js` (ENG-1677). The Vercel style guide has no
 * flat-config support, so the baseline is now eslint + typescript-eslint recommended.
 */
export const library = [
  commonIgnores,
  // carried over from the legacy library.js ignorePatterns
  { ignores: ["**/*.config.{js,cjs,mjs,ts,mts}", "**/*.d.ts"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
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
