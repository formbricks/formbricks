const { resolve } = require("node:path");

const project = resolve(process.cwd(), "tsconfig.json");

/*
 * This is a custom ESLint configuration for use with
 * typescript packages.
 *
 * This config extends the Vercel Engineering Style Guide.
 * For more information, see https://github.com/vercel/style-guide
 *
 */

module.exports = {
  extends: ["@vercel/style-guide/eslint/node", "@vercel/style-guide/eslint/typescript"].map(require.resolve),
  parserOptions: {
    project,
  },
  globals: {
    React: true,
    JSX: true,
  },
  settings: {
    "import/resolver": {
      typescript: {
        project,
      },
      node: {
        extensions: [".mjs", ".js", ".jsx", ".ts", ".tsx"],
      },
    },
  },
  ignorePatterns: ["node_modules/", "dist/", "*.config.js", "*.config.ts", "*.d.ts"],
};
