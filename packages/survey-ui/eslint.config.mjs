import react from "@formbricks/eslint-config/react";

export default [
  // carried over from the legacy .eslintrc ignorePatterns
  { ignores: ["**/*.stories.tsx", "**/*.stories.ts", "**/story-helpers.tsx", "**/*.test.ts"] },
  ...react,
];
