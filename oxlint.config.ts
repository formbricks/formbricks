import { defineConfig } from "oxlint";

/*
 * Root oxlint config. `pnpm lint` runs oxlint once from the repo root; every workspace that lints
 * has its own `oxlint.config.ts`, which composes one tier from `@formbricks/config-oxlint`, and
 * oxlint uses the nearest config for each file. This file only carries the options oxlint reads from
 * the root config, and it enables no rules for the files it covers itself (root scripts, the
 * `config-*` packages), which ESLint did not lint either. Linting those is part of ENG-7329.
 */
export default defineConfig({
  categories: { correctness: "off" },
  // Deployment collateral, not repo code: the Cube schema copies in charts/ and docker/ carry their
  // own ESLint-era directives and are not linted.
  ignorePatterns: ["charts/**", "docker/**"],
  options: {
    // Stale disable directives surface as warnings, so obsolete suppressions can't accumulate.
    reportUnusedDisableDirectives: "warn",
  },
  // Type-aware rules (typescript-eslint's recommendedTypeChecked set, in the library, react and
  // react-hooks tiers) run through oxlint-tsgolint when oxlint gets `--type-aware`, which
  // `pnpm lint:code` passes. It is a flag rather than `options.typeAware` because tsgolint builds the
  // TypeScript program of every linted file once it is on, rule or not: the pre-commit hook leaves
  // it off for apps/web, which has no type-aware rules, and saves ~4s per commit there.
});
