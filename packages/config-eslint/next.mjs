import js from "@eslint/js";
import nextConfig from "eslint-config-next";
import jsxA11y from "eslint-plugin-jsx-a11y";
import tseslint from "typescript-eslint";
import { base, commonIgnores, typescriptParsing, unusedVarsConvention } from "./base.mjs";

/*
 * Flat config for the Next.js app — the successor of `legacy-next.js`:
 * eslint-config-next + turbo + prettier + the vitest convention, with the same rule
 * overrides the legacy config carried.
 *
 * The eslint/typescript-eslint recommended baselines are active but downgraded to
 * warnings (ENG-2264): apps/web was never linted against them, so the backlog is
 * large and enabling them as errors in one step would block every PR. Rules are
 * promoted to "error" individually as their violation count reaches zero — the
 * per-rule counts and ratchet plan live on the ticket. `recommendedTypeChecked`
 * (used by the library/react tiers) is a separate decision, also tracked there.
 */

// The recommended baselines ship rules at "error"; keep their options but lower the
// severity so the backlog surfaces without failing CI. "off" entries (e.g. the core
// rules that eslint-recommended disables for TS files) pass through untouched.
const isErrorSeverity = (severity) => severity === "error" || severity === 2;

const downgradeToWarn = ({ rules, ...config }) => ({
  ...config,
  ...(rules && {
    rules: Object.fromEntries(
      Object.entries(rules).map(([id, entry]) => {
        if (Array.isArray(entry)) {
          const [severity, ...options] = entry;
          return [id, isErrorSeverity(severity) ? ["warn", ...options] : entry];
        }
        return [id, isErrorSeverity(entry) ? "warn" : entry];
      })
    ),
  }),
});

export const next = [
  commonIgnores,
  typescriptParsing,
  downgradeToWarn(js.configs.recommended),
  ...tseslint.configs.recommended.map(downgradeToWarn),
  // Same underscore convention as the other tiers, at warning severity like the rest
  // of the baseline; without the options, default no-unused-vars would flag the
  // repo-sanctioned `_`-prefixed intentionally-unused bindings.
  downgradeToWarn(unusedVarsConvention),
  ...nextConfig,
  {
    rules: {
      "@next/next/no-html-link-for-pages": "off",
      "react/jsx-key": "off",
    },
  },
  // eslint-config-next registers the jsx-a11y plugin but enables only six of its rules; this adds
  // the rest of the recommended set, the floor the react/react-hooks tiers already enforce. Rules
  // only, scoped to the files eslint-config-next registers the plugin for: it registers its own
  // copy of the plugin object, so passing ours under the same key throws "Cannot redefine plugin".
  // Severities below the upstream "error" are set per rule by the consumer (apps/web).
  {
    files: ["**/*.{js,jsx,mjs,ts,tsx,mts,cts}"],
    rules: jsxA11y.flatConfigs.recommended.rules,
  },
  ...base,
];

export default next;
