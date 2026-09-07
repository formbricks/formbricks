import library from "@formbricks/config-eslint/library";

export default [
  ...library({ tsconfigRootDir: import.meta.dirname }),
  {
    rules: {
      // runtime-only env reads; hashing them in turbo.json is tracked separately (ENG-1682)
      "turbo/no-undeclared-env-vars": ["error", { allowList: ["OTEL_LOGS_ENABLED", "NEXT_PHASE"] }],
    },
  },
];
