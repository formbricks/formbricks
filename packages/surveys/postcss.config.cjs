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

// Re-scopes `:root` and `:host` selectors inside `@layer theme` to `#fbjs`.
//
// Problem: Tailwind v4 emits `@layer theme { :root, :host { --color-*; --spacing; ... } }`
// which sets CSS custom properties globally. When the survey widget injects this
// into the host page, it overrides the host site's own Tailwind theme variables,
// causing buttons and other styled elements to change color/appearance.
//
// Fix: Replace `:root` / `:host` selectors with `#fbjs` so theme variables are
// scoped to the survey widget. CSS custom properties inherit, so all survey
// descendants still pick them up.
const scopeLayerTheme = () => {
  return {
    postcssPlugin: "postcss-scope-layer-theme",
    AtRule: {
      layer: (atRule) => {
        if (atRule.params !== "theme") return;
        atRule.walkRules((rule) => {
          rule.selectors = rule.selectors.map((sel) => {
            if (sel === ":root" || sel === ":host") return "#fbjs";
            return sel;
          });
        });
      },
    },
  };
};
scopeLayerTheme.postcss = true;

// Replaces global `@property --tw-*` declarations with a scoped `#fbjs` rule
// that provides the same initial values.
//
// Problem: `@property` is globally scoped by spec and cannot be confined to
// `#fbjs`. Tailwind v4 emits declarations like:
//   @property --tw-gradient-to-position { syntax: "<length-percentage>"; inherits: false; initial-value: 100% }
//
// `inherits: false` breaks inheritance of `--tw-*` custom properties on the
// host page, and the `syntax` constraint rejects host-page values that don't
// match. Both cause host-page Tailwind v3 utilities to lose their styling.
//
// Fix: Collect each property's initial-value, remove the `@property` rule,
// then emit a single `#fbjs, #fbjs *, #fbjs ::before, #fbjs ::after` rule
// with the initial values. This gives the survey widget the defaults it needs
// while keeping everything scoped.
const replaceAtPropertyWithScoped = () => {
  return {
    postcssPlugin: "postcss-replace-at-property-with-scoped",
    OnceExit(root) {
      const collected = new Map();
      root.walkAtRules("property", (atRule) => {
        if (!atRule.params.startsWith("--tw-")) return;
        const name = atRule.params;
        atRule.walkDecls("initial-value", (decl) => {
          collected.set(name, decl.value);
        });
        atRule.remove();
      });

      if (collected.size === 0) return;
      const postcss = require("postcss");
      const rule = postcss.rule({
        selectors: ["#fbjs", "#fbjs *", "#fbjs ::before", "#fbjs ::after", "#fbjs ::backdrop"],
      });
      for (const [name, value] of collected) {
        rule.append(postcss.decl({ prop: name, value }));
      }
      root.append(rule);
    },
  };
};
replaceAtPropertyWithScoped.postcss = true;

module.exports = {
  plugins: [require("@tailwindcss/postcss"), require("autoprefixer"), remtoEm(), stripLayerProperties(), scopeLayerTheme(), replaceAtPropertyWithScoped()],
};
