import reactPlugin from "eslint-plugin-react";

/*
 * The eslint-plugin-react rules oxlint does not implement natively, loaded as the `react-js` JS
 * plugin.
 *
 * `prefer-read-only-props` reports without its autofix. The fixer writes `readonly` on each member,
 * while CODING_STANDARDS.md asks for the `Readonly<Props>` wrapper, so `pnpm lint:fix` and an
 * editor's fix-on-save would rewrite props in the wrong style. The ESLint setup kept it out of
 * `lint:fix` with `--rule "react/prefer-read-only-props: off"`; oxlint's `-A` does not override a
 * workspace config, so the fix is removed here instead. Fixes are made by hand with the wrapper.
 */

const withoutAutofix = (rule) => ({
  ...rule,
  meta: { ...rule.meta, fixable: undefined },
  create(context) {
    const report = (descriptor) => {
      const { fix: _fix, ...rest } = descriptor;
      context.report(rest);
    };
    // oxlint's context defines `report` as a non-configurable property, so a Proxy cannot swap it;
    // an object inheriting from the context can shadow it.
    return rule.create(Object.create(context, { report: { value: report } }));
  },
});

export default {
  meta: { name: "react-js" },
  rules: {
    "no-deprecated": reactPlugin.rules["no-deprecated"],
    "prefer-read-only-props": withoutAutofix(reactPlugin.rules["prefer-read-only-props"]),
    "prop-types": reactPlugin.rules["prop-types"],
  },
};
