module.exports = {
  extends: ["@formbricks/eslint-config/library.js"],
  parserOptions: {
    project: "tsconfig.json",
    tsconfigRootDir: __dirname,
  },
  rules: {
    "no-console": "off",
  },
};
