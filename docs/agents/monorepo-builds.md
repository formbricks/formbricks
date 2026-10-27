# Monorepo Builds & Packages

Read before adding a workspace package or shared dependency, wiring one package into another's build
config, styling inside a workspace package, or when a package change does not show up in the app.

## Turbo Task Matrix

Turbo runs a task only in packages that define the matching script and **silently skips** the rest.
Every `packages/*` workspace therefore exposes the standard `lint` / `typecheck` / `test` /
`test:coverage` scripts (plus `build` where there is a compile step). Deliberate exceptions:
`config-*` packages hold only config files (no scripts beyond `clean`); `api-v3-schemas`, `email`,
`types`, and `vite-plugins` are consumed from source, so they have no `build`; `apps/storybook` has no
unit tests by policy (its components are exercised by the feature journeys in `apps/web/playwright`).
Keep new packages on this matrix or document the exception here.

The same skip catches test files that sit outside every workspace. Tests for repo-level scripts
(`scripts/`, `.github/actions/`) run in the root `//#test:root` Turbo task, which `pnpm test` invokes
and `vitest.root.config.mts` scopes. A new `*.test.ts` anywhere else outside `apps/*`, `packages/*`
and `docker/` needs that config's `include` widened, or it never runs.

`types` is mostly declarations, but `validation.ts` is runtime logic and is tested like any other
package — it is in Sonar's scope (ENG-2432), so treat it as covered code, not as a types-only
workspace.

Consuming one of those source-only packages from another package's build config
(`../vite-plugins/node-next-dts`, `.../postcss-scope-fbjs.cjs`, `.../copy-compiled-assets`) takes two
things: declare it in `devDependencies`, and give every build task that reads it a `^build` /
`^build:dev` edge. The declaration alone invalidates nothing — a task's hash folds in the tasks named
in `dependsOn`, so the `^` edge is what carries the helper's contents. A root `pkg#task` block
overwrites the shared task config outright — nothing is inherited — so the `^` entry has to be
repeated in every block that declares the task, or a helper edit silently replays an older build
(ENG-1681, ENG-2925). A package's own `turbo.json` behaves differently: it inherits the shared config
per field, so it only needs `dependsOn` when it is changing it. Guarded by
`apps/web/lib/turbo-vite-plugins-edge.test.ts`.

## Shared dependency versions (pnpm catalog)

Every dependency used by **two or more** workspaces is pinned once in the `catalog:` block of
`pnpm-workspace.yaml`, and each `package.json` references it as `"catalog:"` instead of a version:

```json
"devDependencies": { "typescript": "catalog:", "vitest": "catalog:" }
```

So bumping a shared dependency means editing the catalog entry — never a `package.json`. That is the
whole point: `nodeLinker: hoisted` hides a version split until it breaks, so `apps/web` was typing a
redis 5 client with redis 4's `RedisClientType` and one package was building on a different Vite major
than the other fourteen. Deps with a single consumer deliberately stay in their own `package.json`.

`pnpm lint` runs `scripts/check-catalog.mjs`, which fails if a workspace declares a literal version for
a catalogued name, or if a dependency is declared by 2+ workspaces without being catalogued. A peer
dependency _range_ is exempt — it is a compatibility declaration for consumers, not an install pin, so
it may legitimately be looser than the catalog (`packages/survey-ui` declares react `^19.0.0` while
pinning 19.2.6 to build against). Adding a new package needs no wiring: the check resolves the
workspace globs from `pnpm-workspace.yaml` itself.

## Survey Packages Build & Cache

The `@formbricks/surveys` package is pre-compiled (Vite → UMD + ESM) and the built bundle is copied to `apps/web/public/js/`. The Next.js app imports from `dist/`, **not** the source files. This means:

- After any change to `packages/surveys` or its dependencies (`packages/survey-ui`, `packages/types`, etc.), you **must rebuild** for changes to take effect in the running app.
- Turborepo caches build outputs aggressively. The copied bundles are declared outputs of the two
  packages' `build` tasks (`$TURBO_ROOT$/apps/web/public/js/…`), so a `pnpm build` cache hit restores
  them together with `dist/**` instead of leaving the app without `/js/formbricks.umd.cjs`
  (ENG-2924). Only `build` declares them: `build:dev` copies through the same plugin, and a second task
  declaring the same paths makes each cache entry capture whatever the other left on disk. If a build
  still looks stale, bypass the cache explicitly:
  ```
  pnpm build --filter=@formbricks/surveys... --force
  ```
- The browser also caches the UMD bundle (`surveys.umd.cjs`) served from `public/js/`. After rebuilding, do a **hard refresh** (Cmd+Shift+R / Ctrl+Shift+R) or disable the browser cache via DevTools to pick up the new bundle.
- If changes still don't appear, restart the Next.js dev server (`pnpm dev`).

## Stale package builds after a branch switch

The same trap applies to **every** workspace package consumed through its built output rather than its
source — `@formbricks/ai`, `@formbricks/database` and `@formbricks/i18n-utils` resolve via `dist/` in
their `exports` map, so `apps/web` imports the build, not `src/`. `git switch`, a rebase, or a pull changes `src/` but leaves
`dist/` exactly as it was, and nothing warns you.

**This only bites when you bypass Turborepo.** Running `vitest` or `tsc` directly inside `apps/web`,
`pnpm --filter @formbricks/web test`, or an IDE test runner all skip the task graph — which is how you
usually meet it, iterating on one test file. The root `pnpm test` and `pnpm typecheck` are safe:
`@formbricks/web#test` and `@formbricks/web#typecheck` in `turbo.json` each declare `dependsOn` on
`@formbricks/ai#build`, `@formbricks/database#build` and five more, so turbo rebuilds them before the
suite runs. That is also why the unit-test workflow (`test.yml`) stays green with no build step of its
own — do **not** read "green on CI, red locally" as evidence of a stale `dist/`; both run the same
graph.

The failure looks nothing like a stale build. A symbol added on the branch you just checked out is
absent from `dist/`, so depending on what is missing the import either resolves to `undefined` or fails
outright at module resolution — and both read like real regressions:

- `TypeError: Right-hand side of 'instanceof' is not an object` (the class is in `src/`, not `dist/`)
- a missing named export, or `Failed to resolve entry for package "@formbricks/…"` when `dist/` is
  absent altogether
- `tsc` or Vitest failures in files you never touched

This has cost real time: four failing tests read as a broken `main` from an unrelated PR, when the only
problem was a `dist/` built days earlier. To confirm the diagnosis, check whether a symbol you expect
the package to _export_ is in the built output — present in `src/`, absent from `dist/`, is the
signature. (Pick one the entry really re-exports; an internal helper is legitimately absent from
`dist/index.js` and would read as a false positive.)

```shell
grep -rc "MyNewExport" packages/<pkg>/src packages/<pkg>/dist/index.js
```

Recursive on purpose: `packages/ai/src` has nested directories (`providers/`), and a non-recursive
`src/*.ts` glob reports a symbol defined in one of them as missing from _both_ sides.

The fix is to rebuild the dependency graph:

```shell
pnpm build --filter=@formbricks/web^...
```

(Dependencies only — `^...` excludes the Next app itself. This is the same command
`.github/workflows/integration-tests.yml` runs before its suites, for exactly this reason.)

## Tailwind & Workspace Package CSS

Tailwind v4 detects sources starting from the consuming app's own root (`apps/web` for the Next.js
PostCSS build, the Vite root for `apps/storybook`) and **never descends into `node_modules`** — which
is exactly where every `@formbricks/*` workspace package is linked. A utility used only inside a
workspace package therefore never reaches the consuming app's stylesheet. Consumed workspace packages
ship their own CSS rather than relying on the app to scan them:

- `@formbricks/surveys` — prebuilt bundle served from `apps/web/public/js/` (see the section above).
- `@formbricks/survey-ui` — exports `./styles` (`dist/survey-ui.css`), scoped to `#fbjs`.
- `@formbricks/email` — ships no stylesheet at all; `react-email`'s `Tailwind` component compiles and
  inlines the classes into the email HTML at render time.

If you ever consume a workspace package as raw source **for its styling**, the app has to be told
about that package's files explicitly — detection stops at the app's own root, so nothing else will
pick them up. `apps/storybook` is the worked example: it consumes `packages/survey-ui` as raw source
(its `stories` glob loads `packages/survey-ui/src/**` directly, and Vite aliases the package specifier
to that same source), and it works because `apps/storybook/src/index.css` imports **survey-ui's own
stylesheet**, which carries the `@config` and `@source` covering `packages/survey-ui/src/**` — those
resolve relative to survey-ui's file, so the package declares its own coverage and the app just pulls
it in. Prefer that: let the package own its globs. Only write an `@source` in the app entry when the
files are the app's own (as `index.css` does for `.storybook/**` and `src/**`).

Tailwind is configured CSS-first everywhere. Only two JS/TS Tailwind configs remain
(`packages/survey-ui/tailwind.config.ts` and `packages/surveys/tailwind.config.cjs`) and both are
reached through an explicit `@config` bridge from the package's own stylesheet. Do not add a
`tailwind.config.js` that nothing `@config`s — Tailwind v4 will not load it, and it will silently rot.
