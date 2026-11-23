# `@formbricks/config-oxlint`

Shared [oxlint](https://oxc.rs/docs/guide/usage/linter) config tiers for the Formbricks monorepo. oxlint
lints the whole repo in one run from the root (`pnpm lint:code`); each package/app that lints has a small
`oxlint.config.ts` that composes exactly one tier, and oxlint checks every file against its nearest config.

| Export                       | Contents                                                                                                                         | Used by                                                                                                                                                    |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `./base`                     | `compose()`, turbo env-var checks, the `test`-over-`it` convention, unused-vars `_`-prefix options, common ignores, Sonar parity | (composed by the tiers below)                                                                                                                              |
| `./library`                  | eslint recommended + typescript-eslint `recommendedTypeChecked` (type-aware) + `no-unnecessary-condition`, node globals          | ai, api-v3-schemas, cache, creatives, database, i18n-utils, jobs, js-core, logger, redis-config, storage, types, vite-plugins, workflows, deployment-check |
| `./library` `untypedLibrary` | the library tier without type information: eslint recommended + typescript-eslint `recommended`                                  | root `scripts/`, `.github/`, config-oxlint, config-prettier (`scripts/oxlint.config.ts`)                                                                   |
| `./react`                    | library baseline + react / react-hooks / jsx-a11y recommended, browser globals                                                   | survey-ui, storybook                                                                                                                                       |
| `./react-hooks`              | lite tier: react-hooks + jsx-a11y recommended, no full react/TS rule sets — move consumers to `./react` when ready               | email, surveys                                                                                                                                             |
| `./next`                     | `eslint-config-next`'s rules + eslint recommended + typescript-eslint `recommendedTypeChecked` (type-aware)                      | apps/web                                                                                                                                                   |
| `./csp-safe`                 | `formbricks/restricted-syntax` selectors for markup-parsing APIs in code that runs on customer pages                             | creatives, js-core, survey-ui, surveys                                                                                                                     |
| `./testing`                  | `lintFixtures()`: lints snippets at virtual paths through a workspace's real config, for config regression tests                 | `scripts/*-lint.test.ts`, `apps/web/lib/env-access.test.ts`                                                                                                |

Usage in a package:

```ts
// oxlint.config.ts
import { defineConfig } from "oxlint";
import { denyWarnings } from "@formbricks/config-oxlint/base";
import library from "@formbricks/config-oxlint/library";

export default defineConfig(denyWarnings(library));
```

Local rules compose after the tier: `defineConfig(denyWarnings(compose(library, { rules: {…}, overrides: […] })))`.

Every workspace config wraps its export in `denyWarnings`, which raises each `warn` to `error`, so a
warning fails `pnpm lint:code` and CI (ENG-7401). A rule is either on at `error` or `off`. The one
exception is the staged-lines Sonar-parity rules (below), which the pre-commit hook runs as warnings.
`scripts/deny-warnings-lint.test.ts` fails when a workspace config resolves any other rule to `warn`.

Notes:

- **Rule sets.** `presets.mjs` holds the upstream ESLint presets the repo used (`@eslint/js`,
  typescript-eslint, eslint-plugin-react, react-hooks, jsx-a11y, eslint-config-next) as rule maps.
  Change a severity in the tier that applies a preset, not in `presets.mjs`. On top of them, `base.mjs`
  runs oxlint's `correctness` and `suspicious` categories at `error` in every tier; a rule a tier lists
  keeps the tier's setting. The category rules that clash with repo conventions or still have a backlog
  are `off` in `base.mjs`, each with its count and reason (ENG-7329).
- **JS plugins** run the ESLint plugins oxlint does not implement natively, through its ESLint-compatible
  plugin API: `eslint-plugin-turbo`, `eslint-plugin-sonarjs` and `eslint-plugin-unicorn` (as `unicorn-js`,
  Sonar parity only) and `eslint-plugin-storybook` (apps/storybook). `plugins/formbricks.mjs` is the
  repo's own: oxlint has no `no-restricted-syntax`, so `formbricks/restricted-syntax` takes the same
  selector options; `formbricks/no-inline-lint-config` (on in every tier) fails on ESLint's inline
  config comments (`/* eslint <rule>: … */`, `/* eslint-env */`, `/* global */`, `/* exported */`), which
  oxlint ignores; and `formbricks/prefer-read-only-props` (the `next` and `react` tiers) ports
  eslint-plugin-react's rule without its autofix, which wrote `readonly` members instead of the
  `Readonly<Props>` wrapper.
  JS plugins are slower than native rules. eslint-plugin-react, the slowest, was dropped (ENG-7401): its
  `prop-types` is left to TypeScript, and its `no-deprecated` to React 19's types and `react/no-unsafe`
  with `checkAliases`.
- **Type-aware rules** run through `oxlint-tsgolint` (TypeScript 7) when oxlint gets `--type-aware`, which
  `pnpm lint:code` and the pre-commit hook pass. Every linted `.ts`/`.tsx` file must belong to its
  package's tsconfig, and the tsconfig must be valid for TypeScript 7 (no `baseUrl`, no
  `moduleResolution: node10`, explicit `types` for ambient `@types/*`). Plain `.js`/`.cjs`/`.mjs` files get
  the type-aware rules switched off, and `*.config.*` / declaration files are ignored. apps/web runs them
  too; the ones with a backlog left are `off` in `apps/web/oxlint.config.ts`, each with its count
  (ENG-7329).
- The React Compiler-era react-hooks rules are implemented natively by oxlint under `react/`, at the
  preset's severity in the `react` and `react-hooks` tiers. `apps/web/oxlint.config.ts` sets them
  separately for the `next` tier, where `incompatible-library` is `off`: the app does not run the compiler,
  and its sites are react-hook-form's `watch()` and TanStack Table, used on purpose.
- `sonar-parity.mjs` mirrors the SonarCloud rules that surfaced issues on PRs after local lint passed
  (`sonarjs/cognitive-complexity` at 15, `regex-complexity` at 20, `no-nested-functions`,
  `no-nested-conditional`, `no-nested-template-literals`, `prefer-string-raw`, `prefer-optional-chain`,
  `no-deprecated`, `prefer-nullish-coalescing`, and `vitest/prefer-to-have-length` for tests). They are
  all errors in `pnpm lint` and CI. An exception takes an inline disable with its reason, or, for an
  applied data migration, a per-file override in `packages/database/oxlint.config.ts`. A rule added with a
  backlog can start in `stagedLinesRules`: `scripts/lint-staged-oxlint.mjs` then fails the commit on it
  only inside the staged lines (`STAGED_LINES_RULE_IDS`, empty today), as Sonar judges a PR's new code.
  Every rule except the vitest one skips test files, as Sonar does. The type-aware ones
  join only the tiers that compose `sonarParityTyped()` (not the `next` tier yet).
  `jsx-a11y/no-aria-hidden-on-focusable` (`a11yParity`) is an error in every tier that loads jsx-a11y.
- Stale disable directives are errors repo-wide (`reportUnusedDisableDirectives` in the root
  `oxlint.config.ts`). oxlint honours `eslint-disable` comments as well as its own `oxlint-disable`.
- `jsx-a11y` runs at its recommended (error) severity in both the `react` and `react-hooks` tiers, so
  `packages/surveys` — the renderer respondents actually see — has the same static a11y floor as the
  `survey-ui` components it renders, instead of resting solely on the axe gate in
  `apps/web/playwright/survey-accessibility.spec.ts`.
