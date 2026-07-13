import library from "@formbricks/eslint-config/library";

export default [
  ...library,
  {
    rules: {
      // test-only read of process.env.PATH; hashing it in turbo.json is tracked separately (ENG-1682)
      "turbo/no-undeclared-env-vars": ["error", { allowList: ["PATH"] }],
    },
  },
];
