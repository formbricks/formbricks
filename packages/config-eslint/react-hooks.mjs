import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import { base, commonIgnores, reactCompilerRulesOptOut, typescriptParsing } from "./base.mjs";

/*
 * Flat config mirroring the old `legacy-react.js` tier: turbo + prettier +
 * react-hooks + jsx-a11y + the vitest convention, without the full react/typescript-eslint
 * rule sets. Used by packages (email, surveys) that predate the stricter tiers — move them to
 * `react.mjs` when they are ready.
 */
export const reactHooksConfig = [
  commonIgnores,
  typescriptParsing,
  // v7 exposes flat configs under `configs.flat.*`; the top-level `recommended-latest`
  // is the legacy eslintrc format and crashes ESLint 9.
  reactHooks.configs.flat.recommended,
  // Accessibility rules, at the same severity as the `react.mjs` tier already runs them for
  // survey-ui: `packages/surveys` renders the survey respondents actually see, so it gets the
  // same static a11y floor as the component library it renders (ENG-2262).
  jsxA11y.flatConfigs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
  reactCompilerRulesOptOut,
  ...base,
];

export default reactHooksConfig;
