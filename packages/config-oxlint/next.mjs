import { TYPESCRIPT_FILES, base, compose, jsPlugins, reactSettings, unusedVarsOptions } from "./base.mjs";
import {
  eslintRecommended,
  jsxA11yRecommended,
  next as nextPreset,
  typescriptFileOverrides,
  typescriptRecommended,
} from "./presets.mjs";
import { a11yParity, stagedSeverity } from "./sonar-parity.mjs";

/*
 * Config for the Next.js app: eslint-config-next's rules + turbo + the vitest convention, with the
 * rule overrides the legacy config carried.
 *
 * The eslint/typescript-eslint recommended baselines run at their upstream "error" (ENG-2264,
 * ENG-7329). apps/web was never linted against them, so they started as warnings and were promoted as
 * each backlog reached zero; a rule that still has one is listed at "warn" below, with its count.
 * The type-aware rules (used by the library/react tiers) are not on here yet; turning them on is part
 * of ENG-7329.
 */

export const nextCacheRestriction = {
  name: "next/cache",
  importNames: ["unstable_cache"],
  message: "Use React cache() for request deduplication or cache.withCache() / Redis for shared caching.",
};

export const next = compose(
  base,
  {
    plugins: ["typescript", "react", "jsx-a11y", "nextjs", "import"],
    jsPlugins: [jsPlugins.reactJs],
    env: { browser: true, node: true },
    settings: reactSettings,
    rules: {
      ...eslintRecommended,
      ...typescriptRecommended,
      // ~1,550 left, most of them in tests and mocks. Promote once it reaches zero.
      "typescript/no-explicit-any": "warn",
      // Same underscore convention as the other tiers; without the options, `_`-prefixed
      // intentionally-unused bindings would be flagged.
      "no-unused-vars": ["error", unusedVarsOptions],
      ...nextPreset,
      "nextjs/no-html-link-for-pages": "off",
      "react/jsx-key": "off",
      // Props are read-only: CODING_STANDARDS listed this as a review check, and CodeRabbit raised it
      // by hand on almost every UI PR.
      "react-js/prefer-read-only-props": "error",
      "no-restricted-imports": ["error", { paths: [nextCacheRestriction] }],
      // eslint-config-next enables only six jsx-a11y rules; this adds the rest of the recommended
      // set, the floor the react/react-hooks tiers already enforce. Severities below the upstream
      // "error" are set per rule by the consumer (apps/web).
      ...jsxA11yRecommended,
      // Restate the plugin's default elements, plus the `Image` mapping Next adds for next/image.
      "jsx-a11y/alt-text": [
        "error",
        { elements: ["img", "object", "area", 'input[type="image"]'], img: ["Image"] },
      ],
    },
    overrides: [{ files: TYPESCRIPT_FILES, rules: typescriptFileOverrides }],
  },
  a11yParity(stagedSeverity())
);

export default next;
