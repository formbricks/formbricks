import reactHooks from "@formbricks/config-eslint/react-hooks";

export default [
  ...reactHooks,
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
];
