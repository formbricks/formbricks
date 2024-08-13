module.exports = {
  extends: ["@formbricks/eslint-config/react.js"],
  parserOptions: {
    project: "tsconfig.json",
    tsconfigRootDir: __dirname,
  },
  rules: {
    "@typescript-eslint/no-explicit-any": "off",
    "import/no-relative-packages": "off",
  },
};
