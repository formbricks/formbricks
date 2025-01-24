module.exports = {
  root: true,
  extends: ["@formbricks/eslint-config/next.js"],
  parserOptions: {
    project: "tsconfig.json",
    tsconfigRootDir: __dirname,
  },
  rules: {
    "@typescript-eslint/restrict-template-expressions": "off",
    "import/no-cycle": "off",
  },
  settings: {
    "import/resolver": {
      typescript: {
        project: "tsconfig.json",
      },
    },
  },
};
