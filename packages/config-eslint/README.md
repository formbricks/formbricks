# `@formbricks/config-eslint`

Shared [ESLint 9 flat config](https://eslint.org/docs/latest/use/configure/configuration-files) tiers for the Formbricks monorepo. Each package/app has a small `eslint.config.mjs` that imports exactly one tier:

| Export          | Contents                                                                                                                                                                                            | Used by                                                                                         |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `./base`        | building blocks shared by every tier: turbo env-var checks, prettier compat (always last), the `@vitest` `test`-over-`it` convention, unused-vars `_`-prefix convention, common ignores, TS parsing | (composed by the tiers below)                                                                   |
| `./library`     | eslint + typescript-eslint recommendedTypeChecked (type-aware) + `no-unnecessary-condition`, node globals — exported as a factory taking `tsconfigRootDir`                                          | ai, cache, database, i18n-utils, jobs, js-core, logger, storage, types, vite-plugins, workflows |
| `./react`       | library baseline + react / react-hooks / jsx-a11y recommended, browser globals — exported as a factory taking `tsconfigRootDir`                                                                     | survey-ui, storybook                                                                            |
| `./react-hooks` | lite tier mirroring the old `legacy-react`: react-hooks + jsx-a11y recommended, no full react/TS rule sets — move consumers to `./react` when ready                                                 | email, surveys                                                                                  |
| `./next`        | `eslint-config-next` (flat) + the legacy-next rule parity overrides                                                                                                                                 | apps/web                                                                                        |

Usage in a package (`library` and `react` are factories so the type-aware rules resolve
against the consuming package's own tsconfig via `projectService`):

```js
// eslint.config.mjs
import library from "@formbricks/config-eslint/library";

export default library({ tsconfigRootDir: import.meta.dirname });
```

Notes:

- Type-aware linting requires every linted `.ts`/`.tsx` file to belong to the package's tsconfig
  (or the `projectService` default project). Plain `.js`/`.cjs`/`.mjs` files get the type-aware
  rules switched off (`disableTypeChecked`), and `*.config.*` / declaration files are ignored.
- `apps/storybook` is on the `react` tier like any other React workspace (ENG-2366). Its config used
  to be self-contained because it needed `eslint-plugin-react-hooks` v7 while these tiers pinned v5;
  ENG-1689 moved the plugin into the pnpm catalog, which removed the reason. Only the genuinely
  storybook-specific pieces stay in `apps/storybook/eslint.config.mjs` — the storybook plugin's own
  rules and the Vite react-refresh check. Note its lint script runs `--max-warnings 0`, so a rule
  set to `warn` in these tiers _fails_ storybook's lint rather than just reporting; storybook is
  clean on all of them today.
- The React Compiler-era `react-hooks` rules are not all enforced yet. `reactCompilerRulesOptOut` in
  `base.mjs` holds the ones with a remaining backlog, each at the strongest severity its count
  allows, with the ratchet tickets named inline. `apps/web/eslint.config.mjs` makes the same call
  separately for the `next` tier, where the counts are much larger.
- Stale `eslint-disable` directives are reported as warnings workspace-wide (`reportUnusedDisableDirectives` in `base.mjs`).
- `jsx-a11y` runs at its recommended (error) severity in both the `react` and `react-hooks` tiers, so
  `packages/surveys` — the renderer respondents actually see — has the same static a11y floor as the
  `survey-ui` components it renders, instead of resting solely on the axe gate in
  `apps/web/playwright/survey-accessibility.spec.ts`. `packages/email` gets it from the same tier rather
  than being carved out: it is already clean, and while email clients ignore most ARIA they do honour
  `alt` text and heading/anchor content, which is what the rules that can fire on react-email's DOM
  elements check. Carving it out would cost a second tier to maintain and buy nothing.
