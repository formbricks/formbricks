module.exports = {
  extends: ["@formbricks/eslint-config/react.js"],
  // parser: "@typescript-eslint/parser",
  parserOptions: {
    project: "tsconfig.json",
    tsconfigRootDir: __dirname,
  },
};
