import globals from "globals";
import react from "@formbricks/config-eslint/react";

export default [
  { ignores: ["dist/**"] },
  ...react({ tsconfigRootDir: import.meta.dirname }),
  // Build and dev scripts run under Node, not in the browser.
  { files: ["scripts/**", "dev/**", "*.mjs"], languageOptions: { globals: { ...globals.node } } },
];
