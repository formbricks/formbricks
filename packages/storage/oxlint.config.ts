import { defineConfig } from "oxlint";
import { compose } from "@formbricks/config-oxlint/base";
import library from "@formbricks/config-oxlint/library";

export default defineConfig(
  compose(library, {
    rules: {
      // test-only read of process.env.PATH; hashing it in turbo.json is tracked separately (ENG-1682)
      "turbo/no-undeclared-env-vars": ["error", { allowList: ["PATH"] }],
    },
  })
);
