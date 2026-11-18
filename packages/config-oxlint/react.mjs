import { base, compose, jsPlugins, reactCompilerRulesOptOut, reactSettings } from "./base.mjs";
import { typeCheckedBaseline } from "./library.mjs";
import { jsxA11yRecommended, reactHooksRecommended, reactJsxRuntime, reactRecommended } from "./presets.mjs";
import { a11yParity, sonarParityTyped } from "./sonar-parity.mjs";

/*
 * Config for React component libraries: the library tier's type-aware TypeScript baseline plus
 * react, react-hooks (React Compiler rules included) and jsx-a11y recommended, with browser globals.
 */
export const react = compose(
  base,
  typeCheckedBaseline,
  {
    plugins: ["react", "jsx-a11y"],
    jsPlugins: [jsPlugins.reactJs],
    env: { browser: true },
    settings: reactSettings,
    rules: {
      ...reactRecommended,
      ...reactJsxRuntime,
      // Same rule as the `next` tier: component props are read-only.
      "react-js/prefer-read-only-props": "error",
      // Accessibility rules (parity with the old @vercel/style-guide/react config).
      ...jsxA11yRecommended,
      ...reactHooksRecommended,
      // Upstream ships it at "warn"; at zero violations it fails lint like the rest (ENG-7329).
      "react/exhaustive-deps": "error",
    },
  },
  a11yParity(),
  reactCompilerRulesOptOut,
  sonarParityTyped()
);

export default react;
