import vitest from "@vitest/eslint-plugin";
import prettier from "eslint-config-prettier";
import turbo from "eslint-config-turbo/flat";
import tseslint from "typescript-eslint";

/*
 * Shared plumbing for every Formbricks flat config (ENG-1677):
 * - TypeScript parsing for .ts/.tsx files (for tiers that don't pull in typescript-eslint rules)
 * - Turborepo env-var checks
 * - Prettier compatibility (must stay last so it can disable conflicting stylistic rules)
 * - the repo-wide `test` over `it` convention
 * - common ignores
 *
 * This file intentionally carries no opinionated rule set — the exported tiers
 * (library/react/react-hooks/next) decide how strict each package class is.
 */

export const typescriptParsing = {
  files: ["**/*.{ts,tsx,mts,cts}"],
  languageOptions: {
    parser: tseslint.parser,
  },
};

// Standard monorepo convention: a leading underscore marks intentionally unused
// variables/args (the legacy Vercel style guide allowed the same).
export const unusedVarsConvention = {
  rules: {
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        args: "all",
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
        destructuredArrayIgnorePattern: "^_",
      },
    ],
  },
};

export const vitestConventions = {
  plugins: {
    "@vitest": vitest,
  },
  rules: {
    "@vitest/consistent-test-it": ["error", { fn: "test", withinDescribe: "test" }],
  },
};

export const commonIgnores = {
  ignores: ["**/node_modules/**", "**/dist/**", "**/coverage/**", "**/.turbo/**"],
};

// Turbo checks + test conventions + prettier-compat. Keep prettier last.
export const base = [...turbo, vitestConventions, prettier];
