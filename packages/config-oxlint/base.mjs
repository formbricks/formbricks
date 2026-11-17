import { compose, jsPlugins } from "./compose.mjs";
import { sonarParity } from "./sonar-parity.mjs";

/*
 * Shared plumbing for every Formbricks oxlint config:
 * - Turborepo env-var checks
 * - the repo-wide `test` over `it` convention
 * - the Sonar-parity rules, cognitive complexity included, as errors (see sonar-parity.mjs)
 * - common ignores and file globs
 *
 * This file intentionally carries no opinionated rule set: the exported tiers
 * (library/react/react-hooks/next) decide how strict each package class is.
 *
 * Prettier owns formatting. oxlint enables no stylistic rule unless a config asks for it, so
 * nothing here replaces `eslint-config-prettier`.
 */

export { compose, denyWarnings, jsPlugins } from "./compose.mjs";

export const TYPESCRIPT_FILES = ["**/*.{ts,tsx,mts,cts}"];
export const PLAIN_JS_FILES = ["**/*.{js,cjs,mjs}"];

// Standard monorepo convention: a leading underscore marks intentionally unused
// variables/args (the legacy Vercel style guide allowed the same).
export const unusedVarsOptions = {
  args: "all",
  argsIgnorePattern: "^_",
  varsIgnorePattern: "^_",
  caughtErrorsIgnorePattern: "^_",
  destructuredArrayIgnorePattern: "^_",
  // typescript-eslint's version reports a value only used in a type position (`typeof x`); oxlint's
  // matches that only with this option.
  reportVarsOnlyUsedAsTypes: true,
};

/*
 * React settings shared by oxlint's native react rules and the `react-js` JS plugin. oxlint takes no
 * `"detect"`, so the version is the pnpm catalog's `react` major.minor; bump it with the catalog.
 */
export const reactSettings = { react: { version: "19.2" } };

export const commonIgnores = {
  // `.local/` is the repo-sanctioned scratch dir (root .gitignore); its files sit outside
  // every tsconfig, so type-aware linting would hard-error on them.
  ignorePatterns: ["**/node_modules/**", "**/dist/**", "**/coverage/**", "**/.turbo/**", "**/.local/**"],
};

/*
 * Turbo checks + test conventions + Sonar parity. Every tier composes this first.
 *
 * oxlint's default `correctness` category stays off: only the rules the tiers list run, so the
 * rule set matches what ESLint enforced. Widening it is hardening work (ENG-7329).
 */
export const base = compose(
  commonIgnores,
  {
    categories: { correctness: "off" },
    plugins: ["vitest"],
    jsPlugins: [jsPlugins.turbo],
    rules: {
      // eslint-config-turbo: every env var a task reads must be declared in turbo.json.
      "turbo/no-undeclared-env-vars": "error",
      "vitest/consistent-test-it": ["error", { fn: "test", withinDescribe: "test" }],
    },
  },
  sonarParity()
);

/*
 * React Compiler-era react-hooks rules that `flat.recommended` turns on (ENG-2366), at the
 * strongest severity each one's remaining violation count allows. oxlint implements them natively
 * under `react/`. `apps/web/oxlint.config.ts` makes the same call separately for the `next` tier,
 * where the counts are larger.
 *
 * Counts are for the tiers' consumers — `packages/surveys` (react-hooks tier) and
 * `packages/survey-ui` (react tier); `packages/email` is clean. A warning surfaces without
 * failing lint.
 *
 * Anything still at `warn` here is respondent-facing renderer code, where the fix is a
 * derive-during-render or state-ownership change rather than a mechanical edit — worth doing, but
 * not as a side effect of a lint config change.
 */
export const reactCompilerRulesOptOut = {
  rules: {
    // Impure reads during render in packages/surveys (ENG-3073).
    "react/purity": "warn",
    // Mostly in packages/surveys' survey.tsx (ENG-3071).
    "react/immutability": "warn",
    // Effects that derive state from a prop; the fix is to derive it during render (ENG-3072).
    "react/set-state-in-effect": "warn",
  },
};
