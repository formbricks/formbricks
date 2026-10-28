import globals from "globals";
import react from "@formbricks/config-eslint/react";

export default [
  { ignores: ["dist/**"] },
  ...react({ tsconfigRootDir: import.meta.dirname }),
  // One copy of each helper, in src/shared. Parallel work on separate views left 11 `isRecord`, 4 `plural`
  // and two element-width hooks behind; the review found them, the linter now does.
  {
    files: ["src/views/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "VariableDeclarator[id.name=/^(isRecord|plural)$/]",
          message: "Import it from src/shared (guards.ts, plural.ts) instead of defining a copy.",
        },
        {
          selector: "FunctionDeclaration[id.name=/^(isRecord|plural)$/]",
          message: "Import it from src/shared (guards.ts, plural.ts) instead of defining a copy.",
        },
        {
          // prettier-plugin-tailwindcss drops the leading space inside a template literal, which glues
          // two class names together.
          selector: "JSXAttribute[name.name='className'] > JSXExpressionContainer > TemplateLiteral",
          message: "Build conditional classes with classNames() from src/shared/class-names.",
        },
      ],
    },
  },
  // Build and dev scripts run under Node, not in the browser.
  { files: ["scripts/**", "dev/**", "*.mjs"], languageOptions: { globals: { ...globals.node } } },
];
