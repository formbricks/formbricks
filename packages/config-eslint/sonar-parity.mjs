import vitest from "@vitest/eslint-plugin";
import sonarjs from "eslint-plugin-sonarjs";
import unicorn from "eslint-plugin-unicorn";
import tseslint from "typescript-eslint";

/*
 * Local mirror of the SonarCloud rules that have surfaced issues on PRs after every local check
 * and the CI lint job had passed. Sonar analyses a PR roughly fifteen minutes after the push, so
 * catching these at commit time saves a review round trip.
 *
 * Rollout: existing code violates several of these rules, so the whole-repo lint (`pnpm lint`, the
 * CI lint job) leaves them off. `scripts/lint-staged-eslint.mjs`, which the pre-commit hook runs
 * on the staged files only, sets ESLINT_SONAR_PARITY=warn and fails the commit on a rule in
 * `SONAR_PARITY_RULE_IDS` only inside the staged lines, as Sonar judges a PR's new code: a NEW
 * violation fails the commit while old ones stay untouched, even in the same file.
 *
 * To widen: change `DEFAULT_SEVERITY` below to "error" once the backlog is fixed (or "warn" to
 * surface it in editors and CI first). Every consumer tier picks it up through `base.mjs`.
 */
const DEFAULT_SEVERITY = "off";
const SEVERITIES = new Set(["off", "warn", "error"]);

const resolveSeverity = (value) => (SEVERITIES.has(value) ? value : DEFAULT_SEVERITY);

const SOURCE_FILES = ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"];
// Sonar excludes tests from its sources (sonar-project.properties), and deeply nested
// describe/test callbacks are normal there, so these rules do not run on them.
const TEST_FILES = ["**/*.test.*", "**/*.spec.*", "**/__tests__/**", "**/__mocks__/**"];

/*
 * Flat-config entries for the Sonar-parity rules, at the severity the environment asks for.
 * `severity` is a parameter so tests (and a future whole-repo rollout) can set it directly.
 */
export const sonarParity = (severity = stagedSeverity()) => [
  {
    name: "formbricks/sonar-parity",
    files: SOURCE_FILES,
    ignores: TEST_FILES,
    plugins: { sonarjs, unicorn },
    // In the staged-file run only: sonarjs then encodes each finding's secondary locations (for
    // S3776, every line that adds to the complexity) into its message, so the pre-commit runner can
    // fail a function made too complex by a staged line other than its header. Editors and the
    // whole-repo lint keep plain messages.
    ...(process.env.ESLINT_SONAR_PARITY !== undefined && { settings: { sonarRuntime: true } }),
    rules: {
      // S3776. Sonar's default threshold; eslint-plugin-sonarjs@3 reproduces its exact scores.
      "sonarjs/cognitive-complexity": [severity, 15],
      // S5843. Sonar's default threshold.
      "sonarjs/regex-complexity": [severity, { threshold: 20 }],
      // S2004. Sonar flags functions nested more than four levels deep.
      "sonarjs/no-nested-functions": [severity, { threshold: 4 }],
      // S3358.
      "sonarjs/no-nested-conditional": severity,
      // S4624.
      "sonarjs/no-nested-template-literals": severity,
      // S7780.
      "unicorn/prefer-string-raw": severity,
    },
  },
  {
    // Test-only rule from the vitest plugin the repo already loads.
    name: "formbricks/sonar-parity-tests",
    files: ["**/*.test.{ts,tsx,mts,cts,js,jsx,mjs}"],
    plugins: { "@vitest": vitest },
    rules: {
      "@vitest/prefer-to-have-length": severity,
    },
  },
];

/*
 * S6582. Needs type information, so it only joins tiers that can supply it cheaply:
 * - library and react already parse with a project: `sonarParityTyped()`.
 * - react-hooks (surveys, email) have small tsconfigs: `sonarParityTyped({ ownProject: true })`
 *   adds the project service while the rule is on, so only staged files pay for it.
 * - next (apps/web) has none. Its program is large enough that linting a single staged file
 *   exhausts Node's default heap, so the rule is not mirrored there.
 */
export const sonarParityTyped = ({ severity = stagedSeverity(), ownProject = false } = {}) => ({
  name: "formbricks/sonar-parity-typed",
  // Only `.ts`/`.tsx` outside config, declaration and tsconfig-excluded folders: a file the
  // project service cannot find is a parse error, which would fail the commit.
  files: ["**/*.{ts,tsx}"],
  ignores: [
    ...TEST_FILES,
    "**/*.config.*",
    "**/vitest*.ts",
    "**/.*/**", // TypeScript's include globs skip dot-directories
    "**/*.d.ts",
    "**/integration/**",
    "**/playwright/**",
    "**/.storybook/**",
  ],
  plugins: { "@typescript-eslint": tseslint.plugin },
  ...(ownProject && severity !== "off" && { languageOptions: { parserOptions: { projectService: true } } }),
  rules: {
    "@typescript-eslint/prefer-optional-chain": severity,
    // S1874.
    "@typescript-eslint/no-deprecated": severity,
    // S6606.
    "@typescript-eslint/prefer-nullish-coalescing": severity,
  },
});

/*
 * S6825, for the tiers that load `eslint-plugin-jsx-a11y` (react, react-hooks, next). The
 * recommended preset leaves it off, so `<canvas aria-hidden="true">` passed lint. The react and
 * react-hooks tiers are clean, so they enforce it everywhere (the default). apps/web has one
 * existing violation (the focus-trap button in input-combo-box), so the next tier passes the
 * staged-file severity instead.
 */
export const a11yParity = (severity = "error") => ({
  name: "formbricks/a11y-parity",
  // Like the other mirrored rules, not applied to tests (Sonar excludes them from its sources).
  ignores: TEST_FILES,
  rules: {
    "jsx-a11y/no-aria-hidden-on-focusable": severity,
  },
});

export const stagedSeverity = () => resolveSeverity(process.env.ESLINT_SONAR_PARITY);

/** Every rule above, by id: what the pre-commit runner holds the staged lines to. */
export const SONAR_PARITY_RULE_IDS = [
  ...sonarParity("off").flatMap((entry) => Object.keys(entry.rules)),
  ...Object.keys(sonarParityTyped({ severity: "off" }).rules),
  ...Object.keys(a11yParity("off").rules),
];
