import { defineConfig } from "oxlint";
import { compose, denyWarnings } from "@formbricks/config-oxlint/base";
import { untypedLibrary } from "@formbricks/config-oxlint/library";

/*
 * Repo tooling: the root `scripts/`, `.github/` scripts and actions, and the `config-*` packages.
 * `.github/oxlint.config.ts` and each `config-*` package re-export this config. No tsconfig includes
 * these files, so they get the library tier without type information.
 */
export default defineConfig(
  denyWarnings(
    compose(untypedLibrary, {
      rules: {
        // These run under node, CI or the pre-commit hook, never as Turbo tasks, so no env var they read
        // is a Turbo task input that turbo.json has to declare.
        "turbo/no-undeclared-env-vars": "off",
      },
    })
  )
);
