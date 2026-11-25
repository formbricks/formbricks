import { compose, jsPlugins } from "./compose.mjs";

/*
 * Local mirror of the SonarCloud rules that have surfaced issues on PRs after every local check
 * and the CI lint job had passed. Sonar analyses a PR roughly fifteen minutes after the push, so
 * catching these at lint time saves a review round trip.
 *
 * Every rule here is an error in the whole-repo lint (`pnpm lint`, the CI lint job). An existing
 * exception carries an inline disable with its reason, or (applied data migrations) a per-file
 * override in its package (ENG-7329).
 *
 * A newly mirrored rule whose backlog is not fixed yet goes into `stagedLinesRules` instead. It then
 * runs only in `scripts/lint-staged-oxlint.mjs`, the pre-commit hook's runner on the staged files: it
 * sets OXLINT_SONAR_PARITY=warn and fails the commit on a rule in `STAGED_LINES_RULE_IDS` only inside
 * the staged lines, as Sonar judges a PR's new code: a NEW violation fails the commit while old ones
 * stay untouched, even in the same file. Once its backlog is fixed, move it into `sonarRules`.
 */
const DEFAULT_SEVERITY = "off";
const SEVERITIES = new Set(["off", "warn", "error"]);

const resolveSeverity = (value) => (SEVERITIES.has(value) ? value : DEFAULT_SEVERITY);

export const stagedSeverity = () => resolveSeverity(process.env.OXLINT_SONAR_PARITY);

// Sonar excludes tests from its sources (sonar-project.properties), and deeply nested
// describe/test callbacks are normal there, so these rules do not run on them.
export const TEST_FILES = ["**/*.test.*", "**/*.spec.*", "**/__tests__/**", "**/__mocks__/**"];

const offFor = (rules) => Object.fromEntries(Object.keys(rules).map((id) => [id, "off"]));

const sonarRules = {
  // S3776. Sonar's default threshold; eslint-plugin-sonarjs@3 reproduces its exact scores.
  "sonarjs/cognitive-complexity": ["error", 15],
  // S5843. Sonar's default threshold.
  "sonarjs/regex-complexity": ["error", { threshold: 20 }],
  // S2004. Sonar flags functions nested more than four levels deep.
  "sonarjs/no-nested-functions": ["error", { threshold: 4 }],
  // S3358.
  "sonarjs/no-nested-conditional": "error",
  // S4624.
  "sonarjs/no-nested-template-literals": "error",
  // S7780. eslint-plugin-unicorn's own rule: oxlint's native one skips template literals that hold
  // an expression, which Sonar flags.
  "unicorn-js/prefer-string-raw": "error",
};

// Rules that still have a backlog, held only to the staged lines (see above). None today.
// eslint-disable-next-line no-unused-vars -- the severity each rule here takes, once there is one
const stagedLinesRules = (severity) => ({});

const testRules = { "vitest/prefer-to-have-length": "error" };

/*
 * Config fragment for the Sonar-parity rules. `stagedLinesSeverity` is the staged-lines rules'
 * severity, from the environment unless a test sets it. When it is "off", as in the whole-repo lint,
 * those rules are left out.
 */
export const sonarParity = (stagedLinesSeverity = stagedSeverity()) => {
  const staged = stagedLinesSeverity === "off" ? {} : stagedLinesRules(stagedLinesSeverity);
  return compose({
    plugins: ["vitest"],
    jsPlugins: [jsPlugins.sonarjs, jsPlugins.unicornJs],
    // In the staged-file run only: sonarjs then encodes each finding's secondary locations (for
    // S3776, every line that adds to the complexity) into its message, so the pre-commit runner can
    // fail a function made too complex by a staged line other than its header.
    settings: stagedLinesSeverity === "off" ? {} : { sonarRuntime: true },
    rules: { ...sonarRules, ...staged },
    overrides: [
      { files: TEST_FILES, rules: offFor({ ...sonarRules, ...staged }) },
      // Test-only rule from the vitest plugin the repo already loads.
      { files: ["**/*.test.{ts,tsx,mts,cts,js,jsx,mjs}"], rules: testRules },
    ],
  });
};

const typedRules = {
  // S6582.
  "typescript/prefer-optional-chain": "error",
  // S1874.
  "typescript/no-deprecated": "error",
  // S6606.
  "typescript/prefer-nullish-coalescing": "error",
};

/*
 * These need type information, so they only join tiers that lint with it (library, react,
 * react-hooks). apps/web lints without type information today; turning it on there is part of
 * ENG-7329.
 */
export const sonarParityTyped = () => {
  return {
    // The react-hooks tier enables no other TypeScript rule, so the plugin is switched on here.
    plugins: ["typescript"],
    overrides: [
      {
        // Only `.ts`/`.tsx` outside config, declaration and tsconfig-excluded folders: a file the
        // TypeScript program does not include has no type information to check.
        files: ["**/*.{ts,tsx}"],
        excludeFiles: [
          ...TEST_FILES,
          "**/*.config.*",
          "**/vitest*.ts",
          "**/.*/**", // TypeScript's include globs skip dot-directories
          "**/*.d.ts",
          "**/integration/**",
          "**/playwright/**",
          "**/.storybook/**",
        ],
        rules: typedRules,
      },
    ],
  };
};

/*
 * S6825, for the tiers that load jsx-a11y (react, react-hooks, next). The recommended preset leaves
 * it off, so `<button aria-hidden="true">` passed lint.
 */
export const a11yParity = () => ({
  rules: { "jsx-a11y/no-aria-hidden-on-focusable": "error" },
  // Like the other mirrored rules, not applied to tests (Sonar excludes them from its sources).
  overrides: [{ files: TEST_FILES, rules: { "jsx-a11y/no-aria-hidden-on-focusable": "off" } }],
});

/** The rules the pre-commit runner holds only the staged lines to, by id. */
export const STAGED_LINES_RULE_IDS = Object.keys(stagedLinesRules("off"));
