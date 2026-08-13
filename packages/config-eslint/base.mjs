import vitest from "@vitest/eslint-plugin";
import prettier from "eslint-config-prettier";
import turbo from "eslint-config-turbo/flat";
import tseslint from "typescript-eslint";

/*
 * Shared plumbing for every Formbricks flat config:
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
  // `.local/` is the repo-sanctioned scratch dir (root .gitignore); its files sit outside
  // every tsconfig, so type-aware linting would hard-error on them.
  ignores: ["**/node_modules/**", "**/dist/**", "**/coverage/**", "**/.turbo/**", "**/.local/**"],
};

// Surface stale `eslint-disable` comments everywhere as warnings (non-blocking) so obsolete
// suppressions can't silently accumulate again after the flat-config migration cleanup.
export const unusedDirectivesConvention = {
  linterOptions: {
    reportUnusedDisableDirectives: "warn",
  },
};

// Turbo checks + test conventions + prettier-compat. Keep prettier last.
export const base = [...turbo, vitestConventions, unusedDirectivesConvention, prettier];
