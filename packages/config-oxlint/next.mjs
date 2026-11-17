import {
  TYPESCRIPT_FILES,
  base,
  compose,
  downgradeToWarn,
  jsPlugins,
  reactSettings,
  unusedVarsOptions,
} from "./base.mjs";
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
 * The eslint/typescript-eslint recommended baselines are active but downgraded to warnings
 * (ENG-2264): apps/web was never linted against them, so the backlog is large and enabling them as
 * errors in one step would block every PR. Rules are promoted to "error" individually as their
 * violation count reaches zero. The type-aware rules (used by the library/react tiers) are not on
 * here yet; turning them on is part of ENG-7329.
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
      ...downgradeToWarn(eslintRecommended),
      ...downgradeToWarn(typescriptRecommended),
      // Same underscore convention as the other tiers, at warning severity like the rest of the
      // baseline; without the options, `_`-prefixed intentionally-unused bindings would be flagged.
      "no-unused-vars": ["warn", unusedVarsOptions],
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
    overrides: [{ files: TYPESCRIPT_FILES, rules: downgradeToWarn(typescriptFileOverrides) }],
  },
  a11yParity(stagedSeverity())
);

export default next;
