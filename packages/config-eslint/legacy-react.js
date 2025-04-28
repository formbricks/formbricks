module.exports = {
  extends: ["turbo", "prettier", "plugin:react-hooks/recommended"],
  plugins: ["@vitest"],
  rules: {
    "@vitest/consistent-test-it": ["error", { fn: "test", withinDescribe: "test" }],
  },
};
