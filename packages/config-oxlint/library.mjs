import { PLAIN_JS_FILES, TYPESCRIPT_FILES, base, compose, unusedVarsOptions } from "./base.mjs";
import {
  eslintRecommended,
  typeAwareOff,
  typescriptFileOverrides,
  typescriptRecommended,
  typescriptRecommendedTypeChecked,
} from "./presets.mjs";
import { sonarParityTyped } from "./sonar-parity.mjs";

/*
 * Config for TypeScript (Node) packages: eslint recommended + typescript-eslint
 * recommendedTypeChecked, with type information from oxlint-tsgolint. Each file is checked against
 * the nearest tsconfig, so every linted `.ts`/`.tsx` file must belong to its package's tsconfig.
 */
export const typeCheckedBaseline = compose(
  // Config files (vite.config.ts, ...) sit outside the package tsconfigs; declaration files are
  // generated, not authored. Carried over from the legacy library.js ignorePatterns.
  { ignorePatterns: ["**/*.config.{js,cjs,mjs,ts,mts}", "**/*.d.{ts,cts,mts}"] },
  {
    plugins: ["typescript"],
    rules: {
      ...eslintRecommended,
      ...typescriptRecommendedTypeChecked,
      "no-unused-vars": ["error", unusedVarsOptions],
    },
    overrides: [
      {
        files: TYPESCRIPT_FILES,
        rules: {
          ...typescriptFileOverrides,
          // from strictTypeChecked (adopted individually, not the whole strict tier)
          "typescript/no-unnecessary-condition": "error",
        },
      },
      // Plain JS files (scripts, .cjs/.mjs configs) live outside the tsconfigs, so the type-aware
      // rules are off for them (typescript-eslint's `disableTypeChecked`).
      { files: PLAIN_JS_FILES, rules: typeAwareOff },
    ],
  }
);

export const library = compose(base, typeCheckedBaseline, { env: { node: true } }, sonarParityTyped());

/*
 * The same tier without type information: eslint recommended + typescript-eslint `recommended`, for
 * repo tooling that no tsconfig includes (the root `scripts/`, `.github/`, the `config-*` packages).
 */
export const untypedLibrary = compose(
  base,
  { ignorePatterns: ["**/*.config.{js,cjs,mjs,ts,mts}", "**/*.d.{ts,cts,mts}"] },
  {
    plugins: ["typescript"],
    env: { node: true },
    rules: {
      ...eslintRecommended,
      ...typescriptRecommended,
      "no-unused-vars": ["error", unusedVarsOptions],
    },
    overrides: [{ files: TYPESCRIPT_FILES, rules: typescriptFileOverrides }],
  }
);

export default library;
