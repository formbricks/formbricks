import globals from "globals";
import react from "@formbricks/config-eslint/react";

export default [
  // carried over from the legacy .eslintrc ignorePatterns
  { ignores: ["**/*.stories.tsx", "**/*.stories.ts", "**/story-helpers.tsx", "**/*.test.ts"] },
  ...react({ tsconfigRootDir: import.meta.dirname }),
  // Node build/CI scripts (e.g. scripts/assert-scoped-css.mjs) run under Node, not the browser.
  { files: ["scripts/**", "*.mjs"], languageOptions: { globals: { ...globals.node } } },
];
