const prismaRestrictedImports = require("./prisma-restricted-imports");

module.exports = {
  extends: ["turbo", "prettier"],
  plugins: ["@vitest"],
  rules: {
    "@vitest/consistent-test-it": ["error", { fn: "test", withinDescribe: "test" }],
    ...prismaRestrictedImports,
  },
};
