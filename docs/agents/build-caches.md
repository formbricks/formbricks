# Build caches and stale `dist/`

Two traps where the running app does not reflect the source you edited. Read this when a change to
`packages/surveys` (or `survey-ui`, `types`) does not show up in the app, or when tests or `tsc` fail in
files you never touched after a branch switch, rebase or pull.

## Survey packages: build and cache

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
