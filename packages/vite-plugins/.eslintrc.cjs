module.exports = {
  extends: ["@formbricks/eslint-config/library.js"],
  // Test files are run by vitest (esbuild) and are excluded from tsconfig, so
  // they are not type-checked and must not be type-aware-linted either. Matches
  // the convention in packages/survey-ui/.eslintrc.cjs.
  ignorePatterns: ["**/*.test.ts"],
  parserOptions: {
    project: "tsconfig.json",
    tsconfigRootDir: __dirname,
  },
};
