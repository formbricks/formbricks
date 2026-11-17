import { defineConfig } from "oxlint";
import { compose } from "@formbricks/config-oxlint/base";
import cspSafe from "@formbricks/config-oxlint/csp-safe";
import react from "@formbricks/config-oxlint/react";

export default defineConfig(
  compose(
    // carried over from the legacy .eslintrc ignorePatterns
    { ignorePatterns: ["**/*.stories.tsx", "**/*.stories.ts", "**/story-helpers.tsx", "**/*.test.ts"] },
    react,
    cspSafe,
    // Node build/CI scripts (e.g. scripts/assert-scoped-css.mjs) run under Node, not the browser.
    { overrides: [{ files: ["scripts/**", "*.mjs"], env: { node: true } }] }
  )
);
