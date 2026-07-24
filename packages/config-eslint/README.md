# `@formbricks/eslint-config`

Shared [ESLint 9 flat config](https://eslint.org/docs/latest/use/configure/configuration-files) tiers for the Formbricks monorepo (ENG-1677). Each package/app has a small `eslint.config.mjs` that imports exactly one tier:

| Export | Contents | Used by |
| --- | --- | --- |
| `./base` | building blocks shared by every tier: turbo env-var checks, prettier compat (always last), the `@vitest` `test`-over-`it` convention, unused-vars `_`-prefix convention, common ignores, TS parsing | (composed by the tiers below) |
| `./library` | eslint + typescript-eslint recommended, node globals | ai, cache, database, i18n-utils, jobs, js-core, logger, storage, types, vite-plugins |
| `./react` | library baseline + react / react-hooks / jsx-a11y recommended, browser globals | survey-ui |
| `./react-hooks` | lite tier mirroring the old `legacy-react`: react-hooks only, no full react/TS rule sets — move consumers to `./react` when ready | email, surveys |
| `./next` | `eslint-config-next` (flat) + the legacy-next rule parity overrides | apps/web |

Usage in a package:

```js
// eslint.config.mjs
import library from "@formbricks/eslint-config/library";

export default library;
```

Notes:

- `apps/storybook` keeps a self-contained flat config (it needs `eslint-plugin-react-hooks` v7's `configs.flat.*`; the tiers here pin v5, whose `recommended-latest` is the flat entry — unify when the v7 compiler-era rules are adopted, tracked under ENG-1677).
- Stale `eslint-disable` directives are reported as warnings workspace-wide (`reportUnusedDisableDirectives` in `base.mjs`).
