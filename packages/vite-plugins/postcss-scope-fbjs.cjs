// Shared PostCSS plugins that confine Tailwind v4's globally-scoped emissions
// to the Formbricks survey container (#fbjs), preventing host-page CSS
// pollution. Consumed by both @formbricks/surveys and @formbricks/survey-ui so
// the scoping logic cannot drift between the two CSS bundles that ship together
// in the injected <style> element (see packages/surveys/src/lib/styles.ts).
//
// Tailwind v4 emits three constructs that are global by spec and therefore
// cannot be confined by Tailwind's `important: "#fbjs"` selector scoping:
//   1. @layer properties { *, :before, :after, ::backdrop { --tw-*: ... } }
//   2. @layer theme      { :root, :host { --color-*, --spacing, ... } }
//   3. @property --tw-*  { inherits: false; syntax: ...; initial-value: ... }
// Each leaks into the host page and breaks host Tailwind utilities (shadows,
// rings, transforms, gradients, theme variables).
//
// See: https://github.com/formbricks/js/issues/46

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
// while keeping everything scoped. The `postcss` helper is provided by the
// plugin runtime, so this module does not depend on `postcss` being resolvable
// from its own directory.
const replaceAtPropertyWithScoped = () => {
  return {
    postcssPlugin: "postcss-replace-at-property-with-scoped",
    OnceExit(root, { postcss }) {
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

// Returns the three scoping plugins as instances, in the order they must run
// (after Tailwind has compiled). Spread into a PostCSS `plugins` array.
const scopeFbjsPlugins = () => [
  stripLayerProperties(),
  scopeLayerTheme(),
  replaceAtPropertyWithScoped(),
];

module.exports = {
  stripLayerProperties,
  scopeLayerTheme,
  replaceAtPropertyWithScoped,
  scopeFbjsPlugins,
};
