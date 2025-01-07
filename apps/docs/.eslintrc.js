module.exports = {
  extends: ["@formbricks/eslint-config/next.js"],
  parserOptions: {
    project: "tsconfig.json",
    tsconfigRootDir: __dirname,
  },
  rules: {
    "@typescript-eslint/restrict-template-expressions": "off",
  },
  settings: {
    "import/resolver": {
      typescript: {
        project: "tsconfig.json",
      },
      node: {
        extensions: [".js", ".ts", ".d.ts", ".tsx"],
        paths: ["."],
      },
      caseSensitive: false,
    },
  },
};
