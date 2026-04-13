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

// Strips the `@layer properties { ... }` block that Tailwind v4 emits as a
// browser-compatibility fallback for `@property` declarations.
//
// Problem: CSS `@layer` at-rules are globally scoped by spec — they cannot be
// confined by a surrounding selector. Even though all other Formbricks survey
// styles are correctly scoped to `#fbjs`, the `@layer properties` block
// contains a bare `*, :before, :after, ::backdrop` selector that resets all
// `--tw-*` CSS custom properties on every element of the host page. This
// breaks shadows, rings, transforms, and other Tailwind utilities on any site
// that uses Tailwind v4 alongside the Formbricks SDK.
//
// The `@property` declarations already present in the same stylesheet cover
// the same browser-compatibility need for all supporting browsers, so removing
// `@layer properties` does not affect survey rendering.
//
// See: https://github.com/formbricks/js/issues/46
const stripLayerProperties = () => {
  return {
    postcssPlugin: "postcss-strip-layer-properties",
    AtRule: {
      layer: (atRule) => {
        if (atRule.params === "properties") {
          atRule.remove();
        }
      },
    },
  };
};
stripLayerProperties.postcss = true;

module.exports = {
  plugins: [require("@tailwindcss/postcss"), require("autoprefixer"), remtoEm(), stripLayerProperties()],
};
