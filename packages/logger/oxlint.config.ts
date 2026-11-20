import { defineConfig } from "oxlint";
import { compose, denyWarnings } from "@formbricks/config-oxlint/base";
import library from "@formbricks/config-oxlint/library";

export default defineConfig(
  denyWarnings(
    compose(library, {
      rules: {
        // runtime-only env reads; hashing them in turbo.json is tracked separately (ENG-1682)
        "turbo/no-undeclared-env-vars": ["error", { allowList: ["OTEL_LOGS_ENABLED", "NEXT_PHASE"] }],
      },
    })
  )
);
