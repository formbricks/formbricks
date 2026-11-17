// The hook runs lint-staged with `--concurrent false`, so these entries run one after another in this
// order: every step reads what the step before it wrote.
export default {
  // oxfmt does not sort JSON keys, so the locale files are sorted first and oxfmt formats the result.
  "{apps/web,packages/surveys}/locales/*.json": ["node scripts/sort-locale-keys.mjs"],
  // Every staged file oxfmt formats: code, JSON, Markdown, YAML, CSS, TOML. Files it doesn't format and
  // files oxfmt.config.mts ignores are skipped, which is why the pattern can be `*`.
  "*": ["oxfmt --no-error-on-unmatched-pattern"],
  // `--fix` with only the `sort-imports` rule on sorts the names inside import braces, which oxfmt
  // leaves alone. scripts/lint-staged-oxlint.mjs then receives the staged paths from lint-staged as
  // argv, so nothing is interpolated into a shell command, and lints each file against its
  // workspace's oxlint.config.ts.
  "(apps|packages)/**/*.{js,ts,jsx,tsx,mjs}": [
    "oxlint -c scripts/oxlint-sort-imports.config.mjs --fix --no-error-on-unmatched-pattern",
    "node scripts/lint-staged-oxlint.mjs",
  ],
  // The translation scan CI runs: every key must be a literal t("…") call that en-US.json holds,
  // and every locale must hold exactly those keys. It reads the whole tree, so no file list.
  "{apps/web,packages/surveys,packages/email}/**/*.{ts,tsx}": () => "pnpm scan-translations",
  "{apps/web,packages/surveys}/**/locales/*.json": () => "pnpm scan-translations",
  "packages/database/schema/**/*.prisma": ["prisma format"],
};
