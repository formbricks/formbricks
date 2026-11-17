import { defineConfig } from "oxlint";
import { compose } from "@formbricks/config-oxlint/base";
import cspSafe from "@formbricks/config-oxlint/csp-safe";
import reactHooks from "@formbricks/config-oxlint/react-hooks";

export default defineConfig(
  compose(reactHooks, cspSafe, {
    overrides: [
      {
        files: ["vite.config.mts"],
        rules: {
          // Neither is an ambient build input: this package's own scripts set them inline
          // (`BUILD_UMD=true vite build` in `build`, `ANALYZE=true vite build` in `build:analyze`),
          // so declaring them in turbo.json would add nothing to the build hash.
          // Same reasoning as packages/database (WEBAPP_URL) and packages/logger.
          "turbo/no-undeclared-env-vars": ["error", { allowList: ["BUILD_UMD", "ANALYZE"] }],
        },
      },
      {
        // Five needless `as string` and an unused `catch (e)`, all inside `evaluateSingleCondition`.
        // It is over Sonar's cognitive-complexity limit, so the pre-commit hook rejects any edit to
        // it until the complexity work splits it (ENG-7329); drop this override then.
        files: ["src/lib/logic.ts"],
        rules: {
          "typescript/no-unnecessary-type-assertion": "off",
          "no-unused-vars": "off",
        },
      },
    ],
  })
);
