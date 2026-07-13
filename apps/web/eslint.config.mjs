import next from "@formbricks/eslint-config/next";

const config = [
  // carried over from the legacy .eslintignore / ignorePatterns
  {
    ignores: [
      ".next/**",
      "public/**",
      "playwright/**",
      "vendor/**",
      "**/package.json",
      "**/tsconfig.json",
    ],
  },
  ...next,
  {
    rules: {
      // runtime-only env read in integration/gen-boolean-client.mjs; hashing it in turbo.json is tracked separately (ENG-1682)
      "turbo/no-undeclared-env-vars": ["error", { allowList: ["PATH"] }],
      // TODO(ENG-1677): enable incrementally — pre-existing violations from the React Compiler-era react-hooks rules
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/incompatible-library": "off",
      "react-hooks/error-boundaries": "off",
      "react-hooks/immutability": "off",
      "react-hooks/exhaustive-deps": "off",
      "react-hooks/preserve-manual-memoization": "off",
    },
  },
];

export default config;
