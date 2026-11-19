import { defineConfig } from "oxlint";

/*
 * Root oxlint config. `pnpm lint` runs oxlint once from the repo root; every workspace that lints
 * has its own `oxlint.config.ts`, which composes one tier from `@formbricks/config-oxlint`, and
 * oxlint uses the nearest config for each file. This file carries the options oxlint reads from the
 * root config; the files it covers itself (the root config files, `docs/`) get only oxlint's
 * `correctness` and `suspicious` categories, which every tier also runs (`base.mjs`).
 * The root `scripts/`, `.github/` and the `config-*` packages have their own config
 * (`scripts/oxlint.config.ts`).
 */
export default defineConfig({
  categories: { correctness: "error", suspicious: "error" },
  // Deployment collateral, not repo code: the Cube schema copies in charts/ and docker/ carry their
  // own ESLint-era directives and are not linted.
  ignorePatterns: ["charts/**", "docker/**"],
  options: {
    // A stale disable directive fails lint, so obsolete suppressions can't accumulate.
    reportUnusedDisableDirectives: "error",
  },
  // Type-aware rules (typescript-eslint's recommendedTypeChecked set, in the library, react and next
  // tiers) run through oxlint-tsgolint when oxlint gets `--type-aware`, which `pnpm lint:code` and the
  // pre-commit hook pass. It is a flag rather than `options.typeAware` so a run can still opt out:
  // tsgolint builds the TypeScript program of every linted file once it is on, rule or not.
});
