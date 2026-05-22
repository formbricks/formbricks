# Checks

Automated verification commands for the Formbricks monorepo. The canonical scripts live in the root [`package.json`](../../package.json) and per-app `package.json` files; everything below maps to those scripts exactly. If a script name doesn't match what's on disk, the disk is correct — update this file.

## Environments Covered

- **Local development** — `pnpm dev` against `pnpm db:up` (Docker Postgres + Valkey + Hub + Cube).
- **Tests** — Vitest (unit/integration) + Playwright (E2E) against the same docker stack.
- **CI** — GitHub Actions runs lint + typecheck + test + build per package via Turborepo.
- **Preview** — branch deploys mirror production env shape, with separate Postgres + Redis + Hub + Cube.
- **Production** — Formbricks Cloud (`IS_FORMBRICKS_CLOUD=1`) and self-hosted (`ghcr.io/formbricks/formbricks:latest`).
- **Self-hosting / containers** — `docker/docker-compose.yml` + `helm-chart/`. Required services: Postgres (`pgvector/pgvector:pg18`), Valkey, Hub, Cube, optional S3-compatible store (RustFS by default).

## Required Services for Local Verification

Most checks require the local stack to be up. Start it before running anything below:

```sh
pnpm db:up          # docker compose -f docker-compose.dev.yml up -d
pnpm dev:setup      # generates ENCRYPTION_KEY / NEXTAUTH_SECRET / CRON_SECRET / CUBEJS_API_SECRET into .env
pnpm db:migrate:dev # apply Prisma migrations against the dev DB
```

Stop with `pnpm db:down`. See `ENV_VARS.md` for the required keys; the `dev:setup` script generates them.

## Canonical Commands

| Command                                              | Purpose                                                                                             | When To Run                                                                     | Expected Signal                                                                                          | Notes                                                                                                                               |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install`                                       | Install all workspace deps from `pnpm-lock.yaml`.                                                   | First clone, after lockfile changes.                                            | Exits 0; `node_modules/` populated.                                                                      | Locked via `packageManager: pnpm@10.32.1`. Do not use `npm` or `yarn`.                                                              |
| `pnpm db:up` / `pnpm db:down`                        | Start / stop the Docker stack backing dev (Postgres + Valkey + Hub + Cube).                         | Before any task that hits the DB / Redis / Hub / Cube.                          | Containers reach `healthy` state.                                                                        | Compose file: `docker-compose.dev.yml`.                                                                                             |
| `pnpm dev:setup`                                     | Generate required secrets into `.env` from `.env.example`.                                          | Once per fresh clone.                                                           | `.env` exists with `ENCRYPTION_KEY` / `NEXTAUTH_SECRET` / `CRON_SECRET` / `CUBEJS_API_SECRET` populated. | Implemented by [`scripts/setup-dev-env.sh`](../../scripts/setup-dev-env.sh). Idempotent.                                            |
| `pnpm dev`                                           | Run all apps and workers in dev mode in parallel (Turbo `--parallel`).                              | Local development.                                                              | Next.js (`apps/web`) live on `http://localhost:3000`; survey + js-core build watchers running.           | Web uses `next dev --turbopack`. Hot-reload doesn't cover `packages/surveys` — see "Survey runtime cache" below.                    |
| `pnpm go`                                            | Bring up the DB stack and start every package's `go` task (typically `vite --watch` for libraries). | When iterating on `packages/surveys`, `survey-ui`, `js-core` alongside the app. | Same as `dev`, plus library watchers.                                                                    | Runs at `--concurrency 20` via Turbo.                                                                                               |
| `pnpm build`                                         | Production build for every package and app.                                                         | Before release, before CI checks, before final review.                          | All `build` tasks exit 0; `dist/` and `.next/` populated.                                                | Web build runs with `NODE_OPTIONS=--max-old-space-size=8192`.                                                                       |
| `pnpm build --filter=@formbricks/surveys... --force` | Force-rebuild the survey runtime and its dependencies, bypassing Turbo cache.                       | After touching `packages/surveys` / `survey-ui` / `types`.                      | Fresh `surveys.umd.cjs` in `apps/web/public/js/`.                                                        | Required — see "Survey runtime cache" below. Clear `node_modules/.cache/turbo` first if Turbo replays a stale cache.                |
| `pnpm db:migrate:dev`                                | Apply Prisma migrations against the dev DB.                                                         | After pulling, after editing `schema.prisma`.                                   | Migration log ends with "All migrations applied" + Prisma client regenerated.                            | Wraps `prisma generate` + the in-house migration runner.                                                                            |
| `pnpm db:migrate:deploy`                             | Apply pending migrations against a production-shaped DB.                                            | Deploys.                                                                        | Migration log ends with "All migrations applied".                                                        | Uses `MIGRATE_DATABASE_URL` if set; otherwise `DATABASE_URL`.                                                                       |
| `pnpm db:push`                                       | Sync the Prisma schema to the DB without creating a migration.                                      | Spike work only — never production.                                             | `prisma db push` exits 0.                                                                                | Runs with `--accept-data-loss`. Treat as destructive.                                                                               |
| `pnpm db:seed` / `pnpm db:seed:clear`                | Seed (or clear) dev data.                                                                           | After resetting the dev DB.                                                     | Seed script exits 0.                                                                                     | Implemented in `packages/database/src/seed.ts`.                                                                                     |
| `pnpm lint`                                          | ESLint over the workspace via Turbo.                                                                | Before final review and in CI.                                                  | Exits 0; auto-fixes applied by `--fix`.                                                                  | Shared preset: [`@formbricks/eslint-config`](../../packages/config-eslint/).                                                        |
| `pnpm typecheck`                                     | TypeScript `--noEmit` over the workspace.                                                           | After TS changes; in CI.                                                        | Exits 0.                                                                                                 | The web app uses a dedicated `tsconfig.typecheck.json` and runs `next typegen` first.                                               |
| `pnpm test`                                          | Vitest unit + integration suites across the workspace (Turbo, `--no-cache`).                        | After behavior changes; before final review.                                    | Vitest exits 0.                                                                                          | Web tests are loaded with `dotenv -e ../../.env`. Tests for `.tsx` files are intentionally excluded — see Playwright instead.       |
| `pnpm test:coverage`                                 | Vitest with `@vitest/coverage-v8`.                                                                  | When touching critical flows or measuring drift.                                | Coverage report generated; no regression.                                                                | Same env wiring as `pnpm test`.                                                                                                     |
| `pnpm test:e2e`                                      | Playwright E2E suite against a running app.                                                         | Before merging UI changes; in CI on the slow lane.                              | Playwright exits 0; report in `playwright-report/`.                                                      | Specs live in [`apps/web/playwright/`](../../apps/web/playwright/). Tag slow suites `@slow`.                                        |
| `pnpm test-e2e:azure`                                | Playwright in the Azure-hosted browser service with 10 parallel workers.                            | Cloud CI runs.                                                                  | Same as `test:e2e`.                                                                                      | Uses `playwright.service.config.ts`.                                                                                                |
| `pnpm format`                                        | Format `.ts`/`.tsx`/`.md` files via Prettier (110-char width, semicolons, double quotes).           | After code/docs edits; before final review.                                     | Files rewritten as needed; pre-commit hook reformats staged files.                                       | The `lint-staged` hook (`husky` + `lint-staged`) runs Prettier on staged files automatically. The `oxfmt` migration is a follow-up. |
| `pnpm storybook`                                     | Run the Storybook dev server for the component library.                                             | When reviewing UI changes in isolation.                                         | Storybook on `http://localhost:6006`.                                                                    | Lives in [`apps/storybook`](../../apps/storybook/).                                                                                 |
| `pnpm i18n`                                          | Generate missing translations (via lingo.dev) and scan for unused keys.                             | After adding `t("…")` keys.                                                     | Exits 0; locale files updated.                                                                           | Wraps `pnpm i18n:web:generate` + `pnpm i18n:surveys:generate` + `pnpm scan-translations`.                                           |
| `pnpm i18n:validate`                                 | Scan for missing / unused translation keys without regenerating.                                    | CI gate, when you don't want side effects.                                      | Exits 0.                                                                                                 | Implemented in [`packages/i18n-utils`](../../packages/i18n-utils/).                                                                 |
| `pnpm --filter @formbricks/web generate-api-specs`   | Regenerate OpenAPI specs from zod schemas (`zod-openapi`).                                          | After API surface changes.                                                      | Updated `openapi.yml` + client endpoint files.                                                           | Followed by `pnpm --filter @formbricks/web merge-client-endpoints` to fold in client-API routes.                                    |
| `pnpm clean`                                         | Remove `.turbo`, `node_modules`, `coverage`, `out` across the workspace.                            | When Turbo cache is suspected stale.                                            | Filesystem reclaimed.                                                                                    | Use `pnpm clean:all` to additionally remove `pnpm-lock.yaml`.                                                                       |

## Survey Runtime Cache (the gotcha)

The `@formbricks/surveys` package is pre-compiled (Vite → UMD + ESM) and the built bundle is copied to `apps/web/public/js/`. The Next.js app imports from `dist/`, **not** the source files. After changing `packages/surveys`, `packages/survey-ui`, or `packages/types`:

```sh
rm -rf packages/surveys/dist apps/web/public/js/surveys.* node_modules/.cache/turbo
pnpm build --filter=@formbricks/surveys... --force
```

Then hard-refresh the browser (Cmd+Shift+R / Ctrl+Shift+R) to bust the served `surveys.umd.cjs`. If the change still doesn't appear, restart `pnpm dev`. This is the single most common "why isn't my edit showing up" failure mode in the repo.

## Quick Check Recipes

- **Before opening a PR (light):** `pnpm lint && pnpm typecheck && pnpm test`.
- **Before opening a PR (UI-touching):** the light pass + `pnpm test:e2e` for the affected area + visual check via Storybook / `pnpm dev`.
- **Before opening a PR (schema-touching):** `pnpm db:migrate:dev && pnpm db:seed && pnpm typecheck && pnpm test`. Include the migration file diff in the PR.
- **Before opening a PR (API surface):** add `pnpm --filter @formbricks/web generate-api-specs` and commit the updated `openapi.yml`.
- **Before deploying:** `pnpm build` clean, `pnpm db:migrate:deploy` against the target DB.
- **Workflows PoC slice:** `pnpm --filter @formbricks/database generate`, `pnpm --filter @formbricks/jobs build`,
  `pnpm --filter @formbricks/jobs exec vitest run src/queue.test.ts src/processors.test.ts`,
  `pnpm --filter @formbricks/web exec vitest run app/api/v3/workflows/route.test.ts modules/workflows/lib/workflows-schema.test.ts modules/workflows/lib/executor.test.ts modules/workflows/lib/service.test.ts instrumentation-jobs.test.ts`,
  `pnpm --filter @formbricks/web typecheck`, and `pnpm i18n:validate`. OpenAPI generation stays
  deferred for the PoC per [Decision 003](./decisions/003-workflows-mvp-is-proof-of-concept.md).

## Circuit Breakers

Stop and document the blocker when:

- The same command fails repeatedly with no new evidence — root-cause the failure instead of retrying.
- Required services are unavailable (`pnpm db:up` fails, Hub container won't start, Cube can't reach Postgres). Diagnose the compose stack before continuing.
- Required env vars are missing — `pnpm dev:setup` solves the common case; missing `HUB_API_KEY`, `CUBEJS_API_SECRET`, OAuth credentials, or `STRIPE_*` for the touched flow needs the user.
- A Prisma migration cannot be safely run (data drift, irreversible step). Snapshot the DB, write a down-script, or ask before pressing forward.
- Tests fail intermittently — they're either a real race or a real bug. Don't reroll the dice.
- Verification requires credentials or infrastructure that aren't available (OAuth keys, Stripe webhook secret, SMTP server, Sentry DSN). Note the gap; don't hand-roll fakes.

## Maintenance

Update this file when:

- A new `pnpm` script is added at the root or in `apps/web`.
- A required service is added to the dev compose file.
- A check changes its name, its expected output, or its required env vars.
- The Turbo pipeline changes for any package's `build` / `test` / `lint` / `typecheck` task.
- The Prettier vs `oxfmt` story flips (see `decisions/000-baseline.md` follow-ups).
