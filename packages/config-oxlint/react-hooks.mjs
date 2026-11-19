import { base, compose } from "./base.mjs";
import { jsxA11yRecommended, reactHooksRecommended } from "./presets.mjs";
import { a11yParity, sonarParityTyped } from "./sonar-parity.mjs";

/*
 * Mirrors the old `legacy-react.js` tier: turbo + react-hooks + jsx-a11y + the vitest convention,
 * without the full react/typescript rule sets. Used by packages (email, surveys) that predate the
 * stricter tiers — move them to `react.mjs` when they are ready.
 */
export const reactHooks = compose(
  base,
  {
    plugins: ["react", "jsx-a11y"],
    env: { browser: true },
    rules: {
      ...reactHooksRecommended,
      // Upstream ships it at "warn"; at zero violations it fails lint like the rest (ENG-7329).
      "react/exhaustive-deps": "error",
      // Accessibility rules, at the same severity as the `react` tier runs them for survey-ui:
      // `packages/surveys` renders the survey respondents actually see, so it gets the same static
      // a11y floor as the component library it renders (ENG-2262).
      ...jsxA11yRecommended,
    },
  },
  a11yParity(),
  sonarParityTyped()
);

export default reactHooks;
