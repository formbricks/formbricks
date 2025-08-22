module.exports = {
  root: true,
  ignorePatterns: ["node_modules/", "dist/", "coverage/"],
  overrides: [
    {
      files: ["packages/cache/**/*.{ts,js}"],
      extends: ["@formbricks/eslint-config/library.js"],
      parserOptions: {
        project: "./packages/cache/tsconfig.json",
      },
    },
  ],
};
