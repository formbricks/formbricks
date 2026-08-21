# `@formbricks/config-typescript`

Shared `tsconfig` presets for the Formbricks monorepo. Every package/app `tsconfig.json` extends exactly one of these:

| Config               | Contents                                                                                                              | Used by                                                                                 |
| -------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `base.json`          | strict defaults shared by everything: `module: ESNext`, `moduleResolution: bundler`, declarations, unused-code checks | (composed by the presets below)                                                         |
| `js-library.json`    | base + `ES2022` target/lib and `dist` output — for bundled (Vite/tsup) TS libraries                                   | ai, cache, i18n-utils, jobs, js-core, logger, storage, surveys, vite-plugins, workflows |
| `react-library.json` | js-library-style settings + `jsx: react-jsx`                                                                          | email, survey-ui, apps/storybook                                                        |
| `nextjs.json`        | base + Next.js plugin, `noEmit`, JSX preserve                                                                         | apps/web                                                                                |
| `node16.json`        | base + `module: commonjs`, classic `node10` resolution — legacy escape hatch for CJS packages                         | database, types                                                                         |

`node16.json` deliberately keeps the classic Node resolution: its consumers emit/consume CommonJS, which the `bundler` resolution in `base.json` doesn't allow. Don't use it for new packages — prefer `js-library.json`.
