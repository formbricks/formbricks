export default {
  "(apps|packages)/**/*.{js,ts,jsx,tsx,mjs}": [
    "prettier --write",
    // Runs each touched package's own check-only `lint` script (its own eslint.config.mjs),
    // scoped to packages changed since HEAD (not their dependents) so untouched packages aren't relinted.
    () => 'pnpm --filter "[HEAD]" --filter "!formbricks" run lint',
  ],
  "*.json": ["prettier --write"],
  "packages/database/schema.prisma": ["prisma format"],
};
