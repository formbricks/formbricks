module.exports = {
  extends: ["next", "turbo", "prettier"],
  plugins: ["@vitest"],
  rules: {
    "@next/next/no-html-link-for-pages": "off",
    "react/jsx-key": "off",
    "@vitest/consistent-test-it": ["error", { fn: "test", withinDescribe: "test" }],
  },
};
