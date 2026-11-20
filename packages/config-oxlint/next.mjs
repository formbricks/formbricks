import {
  PLAIN_JS_FILES,
  TYPESCRIPT_FILES,
  base,
  compose,
  reactSettings,
  unusedVarsOptions,
} from "./base.mjs";
import {
  eslintRecommended,
  jsxA11yRecommended,
  next as nextPreset,
  typeAwareOff,
  typescriptFileOverrides,
  typescriptRecommended,
  typescriptRecommendedTypeChecked,
} from "./presets.mjs";
import { a11yParity } from "./sonar-parity.mjs";

/*
 * Config for the Next.js app: eslint-config-next's rules + turbo + the vitest convention, with the
 * rule overrides the legacy config carried.
 *
 * The eslint/typescript-eslint recommended baselines run at their upstream "error" (ENG-2264,
 * ENG-7329). apps/web was never linted against them, so they started as warnings and were promoted as
 * each backlog reached zero. The upstream "warn" entries of eslint-config-next are kept as written;
 * apps/web's `denyWarnings` raises them to "error".
 * The type-aware half of `recommendedTypeChecked` runs at "error" on TypeScript files as in the
 * library/react tiers; apps/web turns off the rules that still have a backlog, with their counts.
 */

/**
 * The type-aware half of typescript-eslint's `recommendedTypeChecked`: the rules it adds to
 * `recommended`, which the baseline above already applies.
 */
export const typeAwareRecommended = Object.fromEntries(
  Object.entries(typescriptRecommendedTypeChecked).filter(([rule]) => !(rule in typescriptRecommended))
);

export const nextCacheRestriction = {
  name: "next/cache",
  importNames: ["unstable_cache"],
  message: "Use React cache() for request deduplication or cache.withCache() / Redis for shared caching.",
};

export const next = compose(
  base,
  {
    plugins: ["typescript", "react", "jsx-a11y", "nextjs", "import"],
    env: { browser: true, node: true },
    settings: reactSettings,
    rules: {
      ...eslintRecommended,
      ...typescriptRecommended,
      // Same underscore convention as the other tiers; without the options, `_`-prefixed
      // intentionally-unused bindings would be flagged.
      "no-unused-vars": ["error", unusedVarsOptions],
      ...nextPreset,
      "nextjs/no-html-link-for-pages": "off",
      "react/jsx-key": "off",
      // Props are read-only: CODING_STANDARDS listed this as a review check, and CodeRabbit raised it
      // by hand on almost every UI PR. The repo's own port of eslint-plugin-react's rule (ENG-7401).
      "formbricks/prefer-read-only-props": "error",
      // The lifecycles React deprecated, `UNSAFE_` or not; eslint-plugin-react's `no-deprecated` covered
      // the unprefixed ones until the plugin was dropped (ENG-7401).
      "react/no-unsafe": ["error", { checkAliases: true }],
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
    overrides: [
      { files: TYPESCRIPT_FILES, rules: { ...typescriptFileOverrides, ...typeAwareRecommended } },
      // Plain JS files sit outside the tsconfig, so the type-aware rules are off for them.
      { files: PLAIN_JS_FILES, rules: typeAwareOff },
    ],
  },
  a11yParity()
);

export default next;
