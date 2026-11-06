import vitest from "@vitest/eslint-plugin";
import prettier from "eslint-config-prettier";
import turbo from "eslint-config-turbo/flat";
import sonarjs from "eslint-plugin-sonarjs";
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

/*
 * React Compiler-era react-hooks rules that v7's `flat.recommended` turns on (ENG-2366). These
 * were switched off wholesale during the ESLint 9 migration; each now carries the strongest
 * severity its remaining violation count allows, and the rest of the v7 rule set stays enforced
 * at flat.recommended's own severity. `apps/web/eslint.config.mjs` makes the same call separately
 * for the `next` tier, where the counts are much larger.
 *
 * Counts are for the tiers' consumers — `packages/surveys` (react-hooks tier) and
 * `packages/survey-ui` (react tier); `packages/email` is clean. The package lint scripts are a
 * plain `eslint src`, so a warning surfaces without failing the build.
 *
 * Anything still at `warn` here is respondent-facing renderer code, where the fix is a
 * derive-during-render or state-ownership change rather than a mechanical edit — worth doing, but
 * not as a side effect of a lint config change.
 */
export const reactCompilerRulesOptOut = {
  rules: {
    // 16 violations in packages/surveys. Impure reads during render (ENG-3073).
    "react-hooks/purity": "warn",
    // 10 violations in packages/surveys, mostly in survey.tsx (ENG-3071).
    "react-hooks/immutability": "warn",
    // 1 in packages/surveys, 2 in packages/survey-ui — each an effect that derives state from a
    // prop, so the fix is to derive it during render instead (ENG-3072).
    "react-hooks/set-state-in-effect": "warn",
  },
};

/*
 * The limits SonarCloud holds a pull request's new code to, as warnings here: many existing
 * functions are already over them, and Sonar judges only what a change touches.
 * `scripts/lint-staged-eslint.mjs` fails a commit on these rules inside its staged lines, so a PR
 * meets them before Sonar reports them. The typed tiers add the type-aware ones
 * (`sonarNewCodeTypedRules`).
 */
export const sonarNewCodeConvention = {
  plugins: { sonarjs },
  rules: {
    "sonarjs/cognitive-complexity": ["warn", 15],
    "sonarjs/regex-complexity": ["warn", { threshold: 20 }],
  },
};

/** The type-aware Sonar rules, for the tiers that lint with type information (library, react). */
export const sonarNewCodeTypedRules = {
  "@typescript-eslint/no-deprecated": "warn",
  "@typescript-eslint/prefer-nullish-coalescing": "warn",
};

/** Every rule above, by id: what the pre-commit runner holds the staged lines to. */
export const SONAR_NEW_CODE_RULE_IDS = [
  ...Object.keys(sonarNewCodeConvention.rules),
  ...Object.keys(sonarNewCodeTypedRules),
];

// Turbo checks + test conventions + prettier-compat. Keep prettier last.
export const base = [
  ...turbo,
  sonarNewCodeConvention,
  vitestConventions,
  unusedDirectivesConvention,
  prettier,
];
