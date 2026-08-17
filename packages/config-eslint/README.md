# `@formbricks/eslint-config`

Shared [ESLint 9 flat config](https://eslint.org/docs/latest/use/configure/configuration-files) tiers for the Formbricks monorepo. Each package/app has a small `eslint.config.mjs` that imports exactly one tier:

| Export          | Contents                                                                                                                                                                                            | Used by                                                                                         |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `./base`        | building blocks shared by every tier: turbo env-var checks, prettier compat (always last), the `@vitest` `test`-over-`it` convention, unused-vars `_`-prefix convention, common ignores, TS parsing | (composed by the tiers below)                                                                   |
| `./library`     | eslint + typescript-eslint recommendedTypeChecked (type-aware) + `no-unnecessary-condition`, node globals — exported as a factory taking `tsconfigRootDir`                                          | ai, cache, database, i18n-utils, jobs, js-core, logger, storage, types, vite-plugins, workflows |
| `./react`       | library baseline + react / react-hooks / jsx-a11y recommended, browser globals — exported as a factory taking `tsconfigRootDir`                                                                     | survey-ui                                                                                       |
| `./react-hooks` | lite tier mirroring the old `legacy-react`: react-hooks only, no full react/TS rule sets — move consumers to `./react` when ready                                                                   | email, surveys                                                                                  |
| `./next`        | `eslint-config-next` (flat) + the legacy-next rule parity overrides                                                                                                                                 | apps/web                                                                                        |

Usage in a package (`library` and `react` are factories so the type-aware rules resolve
against the consuming package's own tsconfig via `projectService`):

```js
// eslint.config.mjs
import library from "@formbricks/eslint-config/library";

export default library({ tsconfigRootDir: import.meta.dirname });
```

Notes:

- Type-aware linting requires every linted `.ts`/`.tsx` file to belong to the package's tsconfig
  (or the `projectService` default project). Plain `.js`/`.cjs`/`.mjs` files get the type-aware
  rules switched off (`disableTypeChecked`), and `*.config.*` / declaration files are ignored.
- `apps/storybook` keeps a self-contained flat config (it needs `eslint-plugin-react-hooks` v7's `configs.flat.*`; the tiers here pin v5, whose `recommended-latest` is the flat entry — unify when the v7 compiler-era rules are adopted, tracked under ENG-2366).
- Stale `eslint-disable` directives are reported as warnings workspace-wide (`reportUnusedDisableDirectives` in `base.mjs`).
