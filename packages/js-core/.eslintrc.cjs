module.exports = {
  ignorePatterns: ["coverage/"],
  extends: ["@formbricks/eslint-config/library.js"],
  parserOptions: {
    project: "tsconfig.json",
    tsconfigRootDir: __dirname,
  },
};
