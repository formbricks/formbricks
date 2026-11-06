export default {
  // scripts/lint-staged-eslint.mjs receives the staged paths from lint-staged as
  // argv, so nothing is interpolated into a shell command. It lints each touched
  // package from that package's own directory.
  "(apps|packages)/**/*.{js,ts,jsx,tsx,mjs}": ["prettier --write", "node scripts/lint-staged-eslint.mjs"],
  "*.json": ["prettier --write"],
  // The translation scan CI runs: every key must be a literal t("…") call that en-US.json holds,
  // and every locale must hold exactly those keys. It reads the whole tree, so no file list.
  "{apps/web,packages/surveys,packages/email}/**/*.{ts,tsx}": () => "pnpm scan-translations",
  "{apps/web,packages/surveys}/**/locales/*.json": () => "pnpm scan-translations",
  "packages/database/schema/**/*.prisma": ["prisma format"],
};
