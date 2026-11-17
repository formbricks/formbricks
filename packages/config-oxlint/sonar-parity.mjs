import { compose, jsPlugins } from "./compose.mjs";

/*
 * Local mirror of the SonarCloud rules that have surfaced issues on PRs after every local check
 * and the CI lint job had passed. Sonar analyses a PR roughly fifteen minutes after the push, so
 * catching these at commit time saves a review round trip.
 *
 * Rollout: a rule whose backlog is fixed moves to `enforcedRules` below and is an error everywhere,
 * the whole-repo lint (`pnpm lint`, the CI lint job) included. Existing code still violates the
 * others, so the whole-repo lint leaves them off. `scripts/lint-staged-oxlint.mjs`, which the
 * pre-commit hook runs on the staged files only, sets OXLINT_SONAR_PARITY=warn and fails the commit
 * on one of those in `SONAR_PARITY_RULE_IDS` only inside the staged lines, as Sonar judges a PR's new
 * code: a NEW violation fails the commit while old ones stay untouched, even in the same file.
 *
 * To widen: move a rule to `enforcedRules` once its backlog is fixed, or change `DEFAULT_SEVERITY`
 * below once every backlog is (or "warn" to surface them in editors and CI first). Every consumer
 * tier picks it up through `base.mjs`. The backlog is tracked in ENG-7329.
 */
const DEFAULT_SEVERITY = "off";
const SEVERITIES = new Set(["off", "warn", "error"]);

const resolveSeverity = (value) => (SEVERITIES.has(value) ? value : DEFAULT_SEVERITY);

export const stagedSeverity = () => resolveSeverity(process.env.OXLINT_SONAR_PARITY);

// Sonar excludes tests from its sources (sonar-project.properties), and deeply nested
// describe/test callbacks are normal there, so these rules do not run on them.
export const TEST_FILES = ["**/*.test.*", "**/*.spec.*", "**/__tests__/**", "**/__mocks__/**"];

const offFor = (rules) => Object.fromEntries(Object.keys(rules).map((id) => [id, "off"]));

// Errors whatever the severity: their backlog is fixed (ENG-7329). An existing exception carries an
// inline disable with its reason, or (applied data migrations) a per-file override in its package.
const enforcedRules = () => ({
  // S3776. Sonar's default threshold; eslint-plugin-sonarjs@3 reproduces its exact scores.
  "sonarjs/cognitive-complexity": ["error", 15],
});

const sonarRules = (severity) => ({
  // S5843. Sonar's default threshold.
  "sonarjs/regex-complexity": [severity, { threshold: 20 }],
  // S2004. Sonar flags functions nested more than four levels deep.
  "sonarjs/no-nested-functions": [severity, { threshold: 4 }],
  // S3358.
  "sonarjs/no-nested-conditional": severity,
  // S4624.
  "sonarjs/no-nested-template-literals": severity,
  // S7780. eslint-plugin-unicorn's own rule: oxlint's native one skips template literals that hold
  // an expression, which Sonar flags.
  "unicorn-js/prefer-string-raw": severity,
});

const testRules = (severity) => ({ "vitest/prefer-to-have-length": severity });

/*
 * Config fragment for the Sonar-parity rules: the enforced ones as errors, the rest at the severity
 * the environment asks for. `severity` is a parameter so tests (and a future whole-repo rollout) can
 * set it directly. When the rest are off only the sonarjs JS plugin loads, for the enforced rules.
 */
export const sonarParity = (severity = stagedSeverity()) => {
  if (severity === "off") {
    return {
      jsPlugins: [jsPlugins.sonarjs],
      rules: enforcedRules(),
      overrides: [{ files: TEST_FILES, rules: offFor(enforcedRules()) }],
    };
  }
  return compose({
    plugins: ["vitest"],
    jsPlugins: [jsPlugins.sonarjs, jsPlugins.unicornJs],
    // In the staged-file run only: sonarjs then encodes each finding's secondary locations (for
    // S3776, every line that adds to the complexity) into its message, so the pre-commit runner can
    // fail a function made too complex by a staged line other than its header.
    settings: { sonarRuntime: true },
    rules: { ...enforcedRules(), ...sonarRules(severity) },
    overrides: [
      { files: TEST_FILES, rules: offFor({ ...enforcedRules(), ...sonarRules(severity) }) },
      // Test-only rule from the vitest plugin the repo already loads.
      { files: ["**/*.test.{ts,tsx,mts,cts,js,jsx,mjs}"], rules: testRules(severity) },
    ],
  });
};

const typedRules = (severity) => ({
  // S6582.
  "typescript/prefer-optional-chain": severity,
  // S1874.
  "typescript/no-deprecated": severity,
  // S6606.
  "typescript/prefer-nullish-coalescing": severity,
});

/*
 * These need type information, so they only join tiers that lint with it (library, react,
 * react-hooks). apps/web lints without type information today; turning it on there is part of
 * ENG-7329.
 */
export const sonarParityTyped = (severity = stagedSeverity()) => {
  if (severity === "off") return {};
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
        rules: typedRules(severity),
      },
    ],
  };
};

/*
 * S6825, for the tiers that load jsx-a11y (react, react-hooks, next). The recommended preset leaves
 * it off, so `<button aria-hidden="true">` passed lint. The react and react-hooks tiers are clean,
 * so they enforce it everywhere (the default). apps/web has one existing violation (the focus-trap
 * button in input-combo-box), so the next tier passes the staged-file severity instead.
 */
export const a11yParity = (severity = "error") => ({
  rules: { "jsx-a11y/no-aria-hidden-on-focusable": severity },
  // Like the other mirrored rules, not applied to tests (Sonar excludes them from its sources).
  overrides: [{ files: TEST_FILES, rules: { "jsx-a11y/no-aria-hidden-on-focusable": "off" } }],
});

/**
 * Every rule above that is not enforced, by id: what the pre-commit runner holds the staged lines to.
 * An enforced rule fails the commit anywhere in a staged file, as any error does.
 */
export const SONAR_PARITY_RULE_IDS = [
  ...Object.keys(sonarRules("off")),
  ...Object.keys(testRules("off")),
  ...Object.keys(typedRules("off")),
  "jsx-a11y/no-aria-hidden-on-focusable",
];
