# Monorepo Builds & Packages

Read before adding a workspace package or shared dependency, wiring one package into another's build
config, styling inside a workspace package, adding tests outside a workspace, running integration tests,
or diagnosing a missing package change or a direct test failure after switching branches. Read it also
after pulling or merging main into a checkout that runs a dev server.

## Turbo Task Matrix

Turbo runs a task only in packages that define the matching script and **silently skips** the rest.
Every `packages/*` workspace therefore exposes the standard `lint` / `typecheck` / `test` /
`test:coverage` scripts (plus `build` where there is a compile step). Deliberate exceptions:
`config-*` packages hold only config files (no scripts beyond `clean`); `api-v3-schemas`, `creatives`,
`email`, `types`, and `vite-plugins` are consumed from source, so they have no `build`; `apps/storybook` has no
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

## A dev server after pulling or merging main

A merge brings more than source. `apps/web`'s own `pnpm dev`, and any launch config that runs it,
skips what the root `pnpm go` does before it starts the app, and each gap fails like an app bug:

- **Migrations.** An enum or column error, e.g. `invalid input value for enum "OrganizationRole"`.
  Run `pnpm db:migrate:dev`. `prisma migrate status` can say "up to date" while main's migrations are
  still pending: it reads `packages/database/.prisma-migrations`, which only the repo's migrate script
  fills from `packages/database/migration`.
- **Package builds.** `Module not found: Can't resolve '@formbricks/…'`: see the section above.
- **SpiceDB.** Organizations or surveys missing from the lists, or a 404 on a page that exists. The
  rows are still in Postgres; their permissions are not. On the bundled local endpoint run
  `pnpm authzed:upgrade prepare`, then `pnpm authzed:upgrade check`. The check counts failures but
  names none: when it reports any, run `pnpm authzed:backfill --apply` and read the `organizationId`
  of each entry in its `failures`, then run `pnpm authzed:backfill --organization-id=<id> --apply`
  for each. A run over all organizations returns `authzed_internal` for some that succeed alone.
  An entry with an empty `organizationId` (a failed organization page or orphan sweep) has no
  organization to retry: rerun `pnpm authzed:backfill --apply` in full, not from
  `--after-organization-id`, which can skip the failed page.
  Neither command covers surveys: when surveys are still missing, run
  `pnpm authzed:backfill --scope=survey --apply`. The check's `survey` scope stays `not-ready`, the
  safe fallback, until `pnpm authzed:backfill --scope=survey --apply --mark-ready` passes two clean
  audits; `--apply` alone never sets it.

Start from the root `pnpm go` after a merge: it runs the migrations, the builds and the SpiceDB
preparation first. Restart a dev server that was already running: it keeps the Prisma client it
loaded.

Run the root `pnpm lint` before pushing a merge. Beyond ESLint it runs the repo-wide checks
(`api:v3:check`, `catalog:check`, `workflow:check`, `local-refs:check`, `adr:check`), and two branches
that each pass them can still clash once merged, for example by taking the same ADR number.

## Integration tests

`*.integration.test.ts` files run against the real Postgres and Valkey, not the unit suite's mocks:

```shell
cd apps/web && pnpm test:integration <path>
```

Before the first run: the `formbricks-postgres-1` and `formbricks-valkey-1` containers and the SpiceDB
at `AUTHZED_ENDPOINT` (`pnpm db:up`), the dev database migrated (`pnpm db:migrate:dev`), the workspace
packages built (`pnpm build --filter=@formbricks/web^...`, since this command bypasses Turbo), and
`PASSWORD_RESET_DISABLED=0` in `.env` for the password-reset suites (`.env.example` ships `1`). The harness
(`apps/web/integration/global-setup.ts`) copies the dev database's schema, without its data, into
`formbricks_ba_test` and flushes Valkey database 15, so the dev Postgres and Valkey data are safe; it
copies whatever schema the dev database has.

SpiceDB is not redirected. The suites that call `synchronizeAuthzedIntegrationFixture`
(`apps/web/integration/authzed.ts`) converge the SpiceDB in `.env` with the test database, pruning the
relationships of your dev data: organizations and surveys then vanish from the dev app's lists. Rebuild
them from Postgres after the run with `pnpm authzed:backfill --apply` and
`pnpm authzed:backfill --scope=survey --apply`. CI runs these suites against a disposable SpiceDB.

`packages/database` and `packages/jobs` have integration tests of their own, outside this harness, with
their own opt-in database and Redis URLs: `.github/workflows/integration-tests.yml` has their commands
and variables.

After merging main, run the integration suites of every area both sides changed. A merge that
typechecks can still break a flow: the survey import refused every file with a shared field until its
suite ran.

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
