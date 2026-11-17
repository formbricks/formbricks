// The oxlint config the lint-staged hook fixes staged files with before linting them: only the
// `sort-imports` rule from the shared base tier, so `--fix` sorts the names inside import braces and
// applies no other rule's fix. The full lint (scripts/lint-staged-oxlint.mjs) runs after it.
import { sortImportsRule } from "@formbricks/config-oxlint/base";

export default {
  categories: { correctness: "off" },
  rules: { "sort-imports": sortImportsRule },
};
