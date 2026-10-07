import library from "@formbricks/config-eslint/library";

export default [
  // Written by scripts/generate.ts and verified by `pnpm api:v3:schemas:check`; hand edits are rejected by
  // that check, so linting the file would only report on code nobody is allowed to change.
  { ignores: ["src/generated/**"] },
  ...library({ tsconfigRootDir: import.meta.dirname }),
  {
    // The generator is build tooling. Runtime code (everything apps import) must not reach it, so a
    // generator release can never end up in a served bundle.
    files: ["src/**/*.ts"],
    ignores: ["src/**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@hey-api/*"],
              message: "The generator is a build-time dependency; import it from scripts/ only.",
            },
            {
              group: ["**/scripts/**", "../scripts/*"],
              message: "scripts/ is generator tooling, not runtime code.",
            },
          ],
        },
      ],
    },
  },
];
