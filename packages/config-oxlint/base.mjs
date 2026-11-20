import { compose, jsPlugins, raiseWarnings } from "./compose.mjs";
import { STAGED_LINES_RULE_IDS, sonarParity } from "./sonar-parity.mjs";

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

export { compose, jsPlugins } from "./compose.mjs";

/*
 * Every workspace config wraps its export in this, so a warning fails lint like an error (ENG-7401).
 * The staged-lines Sonar-parity rules are the exception: the pre-commit hook turns them on as
 * warnings and fails a commit on one only inside the lines it stages (sonar-parity.mjs).
 */
export const denyWarnings = (config) => raiseWarnings(config, { except: STAGED_LINES_RULE_IDS });

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
 * React settings for oxlint's native react rules. oxlint takes no
 * `"detect"`, so the version is the pnpm catalog's `react` major.minor; bump it with the catalog.
 */
export const reactSettings = { react: { version: "19.2" } };

export const commonIgnores = {
  // `.local/` is the repo-sanctioned scratch dir (root .gitignore); its files sit outside
  // every tsconfig, so type-aware linting would hard-error on them.
  ignorePatterns: ["**/node_modules/**", "**/dist/**", "**/coverage/**", "**/.turbo/**", "**/.local/**"],
};

/*
 * oxlint's `correctness` and `suspicious` categories run at "error" in every tier. A rule a tier lists
 * keeps the tier's setting; these are the category rules that are off wherever no tier turns them on.
 * The counts are the repo-wide violations when the categories were turned on (ENG-7329); a backlog
 * rule is turned on when its count reaches zero.
 */
const categoryRulesOff = {
  rules: {
    // Clash with the repo's conventions.
    // The automatic JSX runtime needs no `React` in scope (666).
    "react/react-in-jsx-scope": "off",
    // Side-effect imports are intended: stylesheets, `server-only`, Prism grammars (565).
    "import/no-unassigned-import": "off",
    // Prisma (`_count`, `_all`), Node (`__dirname`) and the repo's own internal markers (`__loaded`,
    // `__recallItem`) name things with a leading underscore (148).
    "eslint/no-underscore-dangle": "off",
    // Libraries export the same value as default and named: `import toast from "react-hot-toast"`,
    // `fc.property` from fast-check (177 + 49).
    "import/no-named-as-default": "off",
    "import/no-named-as-default-member": "off",
    // `NonNullable<unknown>` spells "any non-nullish value" on purpose, as `{}` is banned (7).
    "typescript/no-generated-empty-object-type": "off",
    // `new URL(value)` inside a `try` is how the repo validates a URL (6).
    "eslint/no-new": "off",

    // Backlogs (ENG-7329).
    "typescript/no-unsafe-type-assertion": "off", // 7,059
    "vitest/require-mock-type-parameters": "off", // 6,910
    "vitest/no-conditional-expect": "off", // 1,051
    "typescript/consistent-return": "off", // 218
    "eslint/no-shadow": "off", // 200
    "vitest/require-to-throw-message": "off", // 98
    // Mostly tests that assert through a helper the rule does not see (86).
    "vitest/expect-expect": "off",
    "typescript/no-unsafe-enum-assignment": "off", // 86
    "typescript/no-useless-default-assignment": "off", // 80
    // Mostly `expect` in shared assertion helpers outside a test block (74).
    "vitest/no-standalone-expect": "off",
    // Removing a conversion or a `=== true` trusts the static type at runtime boundaries, so each
    // site needs a look rather than the autofix (40, 27, 22).
    "typescript/no-unnecessary-type-conversion": "off",
    "typescript/no-unnecessary-template-expression": "off",
    "typescript/no-unnecessary-boolean-literal-compare": "off",
    // A compare function would change the order of strings the default sort orders by code unit (30).
    "typescript/require-array-sort-compare": "off",
    "typescript/no-unnecessary-type-parameters": "off", // 29
    "jsx-a11y/control-has-associated-label": "off", // 25
    // Attaching `cause` changes the errors these paths throw and log (21).
    "eslint/preserve-caught-error": "off",
    "react/exhaustive-effect-dependencies": "off", // 20
    "typescript/no-misused-spread": "off", // 15
    // The library/react/next tiers run these; the counts are packages/surveys' (react-hooks tier).
    "typescript/unbound-method": "off", // 14
    "typescript/no-base-to-string": "off", // 12
    "typescript/no-unsafe-enum-comparison": "off", // 11
    // Swapping a role for its element changes the rendered survey markup (6; apps/web runs it at "warn").
    "jsx-a11y/prefer-tag-over-role": "off",
    // The embeds (video players, the embed preview) each need their own sandbox policy (3).
    "react/iframe-missing-sandbox": "off",
    // Changing a memo's dependencies changes when it recomputes (3).
    "react/memo-dependencies": "off",
  },
};

/*
 * The `.tsx` unit tests that predate `formbricks/no-tsx-unit-test` (CODING_STANDARDS.md, Testing
 * Guidelines), by repo-relative path. Remove an entry when its test goes; don't add one.
 */
/*
 * Files whose zod schemas keep unknown keys (`formbricks/no-loose-schema`, ENG-7127), each with the
 * reason its open schemas never reach a Prisma write's data. The list only shrinks: a new open schema
 * needs a reason a reviewer accepts, added here in the same PR.
 */
export const LOOSE_SCHEMA_ALLOWLIST = {
  "apps/web/app/api/v3/lib/bounded-parse.test.ts": "Test fixtures for the bounded parser; no write.",
  "apps/web/modules/custom-css/lib/service.ts":
    "Reads only each entry's `source` from a survey payload; the other keys are dropped.",
  "apps/web/modules/mcp/tools/output-schemas.ts":
    "MCP tool output schemas: describe what a tool returns, never parse input.",
  "apps/web/modules/mcp/tools/response-schemas.ts":
    "MCP tool output schemas: describe what a tool returns, never parse input.",
  "apps/web/modules/mcp/tools/survey-output-schemas.ts":
    "MCP tool output schemas: describe what a tool returns, never parse input.",
  "apps/web/modules/mcp/tools/tag-output-schemas.ts":
    "MCP tool output schemas: describe what a tool returns, never parse input.",
  "packages/types/surveys/types.ts":
    "`ZSurveyMetadata`: extra keys are stored inside the `metadata` JSON value, not as write data.",
  "packages/workflows/src/handlers/run-detail.ts":
    "Reads stored run logs for display and picks named fields.",
  "packages/workflows/src/types/common.ts":
    "Builder UI metadata stored inside the workflow definition's JSON value, not as write data.",
  "packages/workflows/src/types/runs.ts": "`ZWorkflowRunData`: run data the server writes as one JSON value.",
  "packages/workflows/src/types/triggers/response-completed.ts":
    "Trigger payload the server builds, kept inside the run data's JSON value.",
};

export const TSX_UNIT_TEST_ALLOWLIST = [
  "apps/web/modules/auth/hooks/use-sign-out.test.tsx",
  "apps/web/modules/ee/analysis/charts/components/embedded-field-rename-button.test.tsx",
  "packages/surveys/src/components/general/survey.test.tsx",
  "packages/surveys/src/lib/use-focus-trap.test.tsx",
];

/*
 * Turbo checks + test conventions + oxlint's correctness and suspicious categories + Sonar parity.
 * Every tier composes this first.
 */
export const base = compose(
  commonIgnores,
  {
    categories: { correctness: "error", suspicious: "error" },
    plugins: ["vitest"],
    jsPlugins: [jsPlugins.turbo, jsPlugins.formbricks],
    rules: {
      // eslint-config-turbo: every env var a task reads must be declared in turbo.json.
      "turbo/no-undeclared-env-vars": "error",
      // oxlint ignores ESLint's inline config comments; configuration belongs in oxlint.config.ts.
      "formbricks/no-inline-lint-config": "error",
      // The November 2026 vulnerability classes (ENG-7450). A zod schema that keeps unknown keys
      // (ENG-7127), outside the files in LOOSE_SCHEMA_ALLOWLIST.
      "formbricks/no-loose-schema": ["error", { allow: Object.keys(LOOSE_SCHEMA_ALLOWLIST) }],
      // A regex compiled from request input in the same file (ENG-7109's class); a pattern loaded from
      // storage is not a source and stays a review check. A safe line disables it with its reason:
      //   // oxlint-disable-next-line formbricks/no-request-regexp -- <reason>
      "formbricks/no-request-regexp": "error",
      // CODING_STANDARDS.md, Testing Guidelines: no component or UI unit tests in `.tsx`.
      "formbricks/no-tsx-unit-test": ["error", { allow: TSX_UNIT_TEST_ALLOWLIST }],
      "vitest/consistent-test-it": ["error", { fn: "test", withinDescribe: "test" }],
      // The correctness category's no-unused-vars, with the repo's leading-underscore convention.
      "no-unused-vars": ["error", unusedVarsOptions],
      // Vitest's `expect` takes a failure message as its second argument.
      "vitest/valid-expect": ["error", { maxArgs: 2 }],
      // A table-driven or wrapped test takes its title from a variable, which the rule cannot type.
      "vitest/valid-title": ["error", { allowArguments: true }],
    },
  },
  categoryRulesOff,
  sonarParity()
);
