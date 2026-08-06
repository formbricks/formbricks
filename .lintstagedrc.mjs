export default {
  // scripts/lint-staged-eslint.mjs receives the staged paths from lint-staged as
  // argv, so nothing is interpolated into a shell command. It lints each touched
  // package from that package's own directory.
  "(apps|packages)/**/*.{js,ts,jsx,tsx,mjs}": ["prettier --write", "node scripts/lint-staged-eslint.mjs"],
  "*.json": ["prettier --write"],
  "packages/database/schema/**/*.prisma": ["prisma format"],
};
