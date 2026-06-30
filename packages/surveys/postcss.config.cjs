// The three #fbjs-scoping plugins (stripLayerProperties, scopeLayerTheme,
// replaceAtPropertyWithScoped) are shared with @formbricks/survey-ui so the
// scoping logic stays identical across both CSS bundles that ship together in
// the injected <style>. See packages/vite-plugins/postcss-scope-fbjs.cjs and
// https://github.com/formbricks/js/issues/46.
const { scopeFbjsPlugins } = require("../vite-plugins/postcss-scope-fbjs.cjs");

// Matches a CSS numeric value followed by "rem" — e.g. "1rem", "1.5rem", "16rem".
// Single character-class + single quantifier: no nested quantifiers, no backtracking risk.
const REM_REGEX = /([\d.]+)(rem)/gi; // NOSONAR -- single character-class quantifier on trusted CSS input; no backtracking risk
const PROCESSED = Symbol("processed");

const remtoEm = (opts = {}) => {
  // This function converts rem units to em units in CSS declarations and media queries
  const { transformMediaQuery = false } = opts;

  return {
    postcssPlugin: "postcss-rem-to-em-plugin",
    Declaration(decl) {
      if (!decl[PROCESSED]) {
        decl.value = decl.value.replace(REM_REGEX, "$1em");
        decl[PROCESSED] = true;
      }
    },

    AtRule: {
      media: (atRule) => {
        if (!atRule[PROCESSED] && transformMediaQuery) {
          atRule.params = atRule.params.replace(REM_REGEX, "$1em");
          atRule[PROCESSED] = true;
        }
      },
    },
  };
};

module.exports = {
  plugins: [require("@tailwindcss/postcss"), require("autoprefixer"), remtoEm(), ...scopeFbjsPlugins()],
};
