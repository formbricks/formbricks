# `@formbricks/config-oxlint`

Shared [oxlint](https://oxc.rs/docs/guide/usage/linter) config tiers for the Formbricks monorepo. oxlint
lints the whole repo in one run from the root (`pnpm lint:code`); each package/app that lints has a small
`oxlint.config.ts` that composes exactly one tier, and oxlint checks every file against its nearest config.

| Export          | Contents                                                                                                                         | Used by                                                                                                                                                    |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `./base`        | `compose()`, turbo env-var checks, the `test`-over-`it` convention, unused-vars `_`-prefix options, common ignores, Sonar parity | (composed by the tiers below)                                                                                                                              |
| `./library`     | eslint recommended + typescript-eslint `recommendedTypeChecked` (type-aware) + `no-unnecessary-condition`, node globals          | ai, api-v3-schemas, cache, creatives, database, i18n-utils, jobs, js-core, logger, redis-config, storage, types, vite-plugins, workflows, deployment-check |
| `./react`       | library baseline + react / react-hooks / jsx-a11y recommended, browser globals                                                   | survey-ui, storybook                                                                                                                                       |
| `./react-hooks` | lite tier: react-hooks + jsx-a11y recommended, no full react/TS rule sets — move consumers to `./react` when ready               | email, surveys                                                                                                                                             |
| `./next`        | `eslint-config-next`'s rules + the eslint/typescript-eslint recommended baselines at `warn`                                      | apps/web                                                                                                                                                   |
| `./csp-safe`    | `formbricks/restricted-syntax` selectors for markup-parsing APIs in code that runs on customer pages                             | creatives, js-core, survey-ui, surveys                                                                                                                     |
| `./testing`     | `lintFixtures()`: lints snippets at virtual paths through a workspace's real config, for config regression tests                 | `scripts/*-lint.test.ts`, `apps/web/lib/env-access.test.ts`                                                                                                |

Usage in a package:

```ts
// oxlint.config.ts
import { defineConfig } from "oxlint";
import library from "@formbricks/config-oxlint/library";

export default defineConfig(library);
```

Local rules compose after the tier: `defineConfig(compose(library, { rules: {…}, overrides: […] }))`.

Notes:

- **Rules are explicit.** oxlint's default `correctness` category is off; `presets.mjs` holds the upstream
  ESLint presets the repo used (`@eslint/js`, typescript-eslint, eslint-plugin-react, react-hooks,
  jsx-a11y, eslint-config-next) as rule maps, so the rule set matches what ESLint enforced. Change a
  severity in the tier that applies a preset, not in `presets.mjs`. Hardening beyond today's set is
  tracked in ENG-7329.
- **JS plugins** run the ESLint plugins oxlint does not implement natively, through its ESLint-compatible
  plugin API: `eslint-plugin-turbo`, `eslint-plugin-react` (as `react-js`, for `prefer-read-only-props`,
  `prop-types` and `no-deprecated`), `eslint-plugin-sonarjs` and `eslint-plugin-unicorn` (as `unicorn-js`,
  Sonar parity only) and `eslint-plugin-storybook` (apps/storybook). `plugins/react-js.mjs` loads the three eslint-plugin-react rules and drops `prefer-read-only-props`'s autofix, which writes `readonly` members instead of the `Readonly<Props>` wrapper. `plugins/formbricks.mjs` is the
  repo's own: oxlint has no `no-restricted-syntax`, so `formbricks/restricted-syntax` takes the same
  selector options, and `formbricks/no-inline-lint-config` (on in every tier) fails on ESLint's inline
  config comments (`/* eslint <rule>: … */`, `/* eslint-env */`, `/* global */`, `/* exported */`), which
  oxlint ignores.
  JS plugins are slower than native rules; `react-js` costs most of apps/web's run.
- **Type-aware rules** run through `oxlint-tsgolint` (TypeScript 7) when oxlint gets `--type-aware`, which
  `pnpm lint:code` and the pre-commit hook pass. Every linted `.ts`/`.tsx` file must belong to its
  package's tsconfig, and the tsconfig must be valid for TypeScript 7 (no `baseUrl`, no
  `moduleResolution: node10`, explicit `types` for ambient `@types/*`). Plain `.js`/`.cjs`/`.mjs` files get
  the type-aware rules switched off, and `*.config.*` / declaration files are ignored. apps/web runs no
  type-aware rules yet (ENG-7329).
- The React Compiler-era react-hooks rules are implemented natively by oxlint under `react/`. Those with a
  remaining backlog sit in `reactCompilerRulesOptOut` (`base.mjs`) at `warn`, with the ratchet tickets
  named inline; `apps/web/oxlint.config.ts` makes the same call separately for the `next` tier.
- `sonar-parity.mjs` mirrors the SonarCloud rules that surfaced issues on PRs after local lint passed
  (`sonarjs/cognitive-complexity` at 15, `regex-complexity` at 20, `no-nested-functions`,
  `no-nested-conditional`, `no-nested-template-literals`, `prefer-string-raw`, `prefer-optional-chain`,
  `no-deprecated`, `prefer-nullish-coalescing`, and `vitest/prefer-to-have-length` for tests). They are off
  for `pnpm lint` and CI because existing code violates them; `scripts/lint-staged-oxlint.mjs` sets
  `OXLINT_SONAR_PARITY=warn` for the pre-commit hook and fails the commit on one only inside the staged
  lines (`SONAR_PARITY_RULE_IDS`), as Sonar judges a PR's new code. Every rule except the vitest one skips
  test files, as Sonar does. `jsx-a11y/no-aria-hidden-on-focusable` (`a11yParity`) is an error in the react
  tiers; apps/web follows the staged severity.
- Stale disable directives are reported as warnings repo-wide (`reportUnusedDisableDirectives` in the
  root `oxlint.config.ts`). oxlint honours `eslint-disable` comments as well as its own `oxlint-disable`.
- `jsx-a11y` runs at its recommended (error) severity in both the `react` and `react-hooks` tiers, so
  `packages/surveys` — the renderer respondents actually see — has the same static a11y floor as the
  `survey-ui` components it renders, instead of resting solely on the axe gate in
  `apps/web/playwright/survey-accessibility.spec.ts`.
