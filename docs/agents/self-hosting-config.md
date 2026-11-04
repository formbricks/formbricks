# Self-Hosting Configuration and Rollouts

Read before adding or renaming an environment variable, or adding a migration. Self-hosters run what the
Docker Compose file and the Helm chart wire, not what `apps/web` reads, so a setting wired in only some of
the places below is silently ignored. Most install and upgrade bugs between 5.2 and 6.1 were found in
Release QA or by users, not in review.

## Wiring an environment variable

A variable the web app reads goes in every one of these:

| Where                                                       | What                                                                                                                                                                                      |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/lib/env.ts`                                       | The server schema and the `runtimeEnv` map. Client components read `lib/env-client.ts`. A direct `process.env` read is a lint error; the exemptions live in `apps/web/eslint.config.mjs`. |
| `apps/web/turbo.json`                                       | `build.env`, so a change invalidates the build cache (`turbo/no-undeclared-env-vars` reports a miss).                                                                                     |
| `.env.example`                                              | A commented line with the default.                                                                                                                                                        |
| `docker/docker-compose.yml`                                 | The `x-environment` block, commented when optional.                                                                                                                                       |
| `docs/self-hosting/configuration/environment-variables.mdx` | The table row: meaning, required or optional, default.                                                                                                                                    |

`NEXT_PUBLIC_*` variables are inlined into the bundle at build time, so a prebuilt image cannot be
configured with one. A setting self-hosters change at runtime is read on the server and passed down.

The Helm chart passes the web app's variables through `deployment.env` and the secret as they are, so
it needs no change for a plain web-app variable. It does need one when the chart computes the value, or
when a bundled service reads it (Hub, taxonomy, Cube, SpiceDB). Then the variable also goes in:

- `charts/formbricks/values.yaml`, under that service's `env`, with its default.
- `charts/formbricks/templates/_helpers.tpl`, in the service's allow-list (the taxonomy list is one
  `has $key (list …)` line).
- That service's deployment template.
- An assertion in `.github/workflows/helm-chart-validation.yml` that renders the chart and greps the value.
- Both compose files: `docker/docker-compose.yml` for self-hosters and `docker-compose.dev.yml` for local
  development.

A variable that is not set must not block boot unless the feature it configures is in use. A missing
`CUBEJS_API_*` or `HUB_API_*` blocked boot for self-hosters who never used analysis (ENG-1064).

## Migrations and rolling upgrades

An upgrade is rolling: the migration runs while the previous release's pods still serve traffic, and on
Helm, Hub pods can start after the migration Job is gone.

- Columns the previous release reads are dropped or renamed one release later. 6.1 dropped
  `Survey.variables` and every 6.0 pod still serving failed its survey reads (formbricks/formbricks#9603).
- Writes from the previous release stay valid. Better Auth 1.6 pods wrote a `NULL` issuer during the 1.7
  upgrade and locked password users out (formbricks/formbricks#9369). A new queue or outbox job type
  must not dead-letter on old workers.
- On the bundled shared database, Prisma migrations run before Hub's goose and River migrations
  (formbricks/formbricks#8104), and migration Jobs wait until PostgreSQL accepts connections.
- A migration converges on a database built with `db:push`: guard `CREATE TYPE`, `ADD CONSTRAINT` and
  `ADD COLUMN` so a re-run or a pushed schema does not fail.
- A backfill `UPDATE` runs outside the transaction that holds the table's `ACCESS EXCLUSIVE` lock.
- A migration's timestamp sorts after the newest migration on `main` when the PR merges, not when the
  branch was cut.
- A data migration runs in one interactive transaction under the runner's timeout
  (`packages/database/src/scripts/migration-runner.ts`): bound its memory with cursor reads, and keep it
  inside the timeout.
- A migration hook keeps working with the previous image's filesystem layout (a read-only root broke older
  images' hooks in formbricks/formbricks#9503).

Breaking upgrade steps go in `docs/self-hosting/advanced/migration.mdx` and in the PR's breaking-changes
table.
