# `@formbricks/config-eslint`

Shared [ESLint 9 flat config](https://eslint.org/docs/latest/use/configure/configuration-files) tiers for the Formbricks monorepo. Each package/app has a small `eslint.config.mjs` that imports exactly one tier:

| Export          | Contents                                                                                                                                                                                            | Used by                                                                                         |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `./base`        | building blocks shared by every tier: turbo env-var checks, prettier compat (always last), the `@vitest` `test`-over-`it` convention, unused-vars `_`-prefix convention, common ignores, TS parsing | (composed by the tiers below)                                                                   |
| `./library`     | eslint + typescript-eslint recommendedTypeChecked (type-aware) + `no-unnecessary-condition`, node globals — exported as a factory taking `tsconfigRootDir`                                          | ai, cache, database, i18n-utils, jobs, js-core, logger, storage, types, vite-plugins, workflows |
| `./react`       | library baseline + react / react-hooks / jsx-a11y recommended, browser globals — exported as a factory taking `tsconfigRootDir`                                                                     | survey-ui                                                                                       |
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
- `apps/storybook` keeps a self-contained flat config. The reason it originally had to (it needed `eslint-plugin-react-hooks` v7 while these tiers pinned v5) is gone — ENG-1689 moved the plugin into the pnpm catalog, so every tier is on v7 and uses `configs.flat.*`. Folding the storybook config into these tiers is now unblocked, tracked under ENG-2366.
- Stale `eslint-disable` directives are reported as warnings workspace-wide (`reportUnusedDisableDirectives` in `base.mjs`).
- `jsx-a11y` runs at its recommended (error) severity in both the `react` and `react-hooks` tiers, so
  `packages/surveys` — the renderer respondents actually see — has the same static a11y floor as the
  `survey-ui` components it renders, instead of resting solely on the axe gate in
  `apps/web/playwright/survey-accessibility.spec.ts`. `packages/email` gets it from the same tier rather
  than being carved out: it is already clean, and while email clients ignore most ARIA they do honour
  `alt` text and heading/anchor content, which is what the rules that can fire on react-email's DOM
  elements check. Carving it out would cost a second tier to maintain and buy nothing.
