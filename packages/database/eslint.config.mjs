import library from "@formbricks/config-eslint/library";

// The library tier (eslint + typescript-eslint recommendedTypeChecked) does not enable `no-console`,
// so the CLI/migration scripts here that log intentionally need no package-wide override.
export default [
  ...library({ tsconfigRootDir: import.meta.dirname }),
  {
    rules: {
      // Runtime-only env read: the ENG-2343 data migration derives the deployment's MCP resource
      // identifier from WEBAPP_URL when it runs, which is not a build input, so declaring it in
      // turbo.json would only add it to the build hash for nothing. Same reasoning as packages/logger.
      "turbo/no-undeclared-env-vars": ["error", { allowList: ["WEBAPP_URL"] }],
    },
  },
];
