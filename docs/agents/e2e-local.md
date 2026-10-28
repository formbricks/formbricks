# Running the Playwright suite in a container

Read this before running `pnpm test:e2e` somewhere that is not the CI runner (a cloud sandbox, a
laptop without Docker). CI's recipe is `.github/workflows/e2e.yml`; this page lists what changes when
Docker is missing. The first run of this recipe took about an hour to work out.

## What the suite needs

- **Node 24** (`.nvmrc`). A sandbox on Node 22 builds, then fails with errors like
  `Promise.try is not a function`. Put a checksum-verified Node 24 first on `PATH` for every command.
- **Postgres 16 with `pgvector`**, Redis, and **SpiceDB** on `:50051`. Without Docker: install
  `postgresql-16`, `postgresql-16-pgvector` and `redis-server`, create the database from `DATABASE_URL`
  with `CREATE EXTENSION vector`, and run the SpiceDB release binary (verify its sha256 against the
  release `checksums.txt`) with `SPICEDB_DATASTORE_ENGINE=memory` and
  `SPICEDB_GRPC_PRESHARED_KEY=$AUTHZED_TOKEN`, as `scripts/start-authzed-ci.sh` does.
- **`.env`** edited the way the "Fill ENTERPRISE*LICENSE_KEY and E2E_TESTING" step does (`REDIS_URL`,
  `AUTHZED_CONSISTENCY=fully_consistent`, `E2E_TESTING=1`, `RATE_LIMITING_DISABLED=1`, the `S3*\*` values).

## Order

1. `E2E_TESTING=1 pnpm build --filter=@formbricks/web...` (about 4 minutes, run it once).
2. `pnpm --filter=@formbricks/database db:migrate:ci`.
3. `pnpm authzed:schema apply` writes the schema without the `zed` image; `pnpm authzed:schema check`
   must then report `matched`.
4. `pnpm authzed:backfill --apply`, then `pnpm authzed:backfill --scope=survey --apply --mark-ready`,
   then `pnpm authzed:outbox drain`. These commands print their JSON result and keep running; the CI step
   kills them once a result line appears, and you must too.
5. `NODE_ENV=test pnpm start --filter=@formbricks/web`, then wait for `/health` to answer 200.
6. The outbox worker from the "Start AuthZed CI outbox worker" step. The fixtures write authorization
   rows through Prisma, so logins hang without it.
7. `CI=true PW_WORKERS=2 pnpm test:e2e`.

## Browser

The Chromium a sandbox ships is often another build than this repo's Playwright expects, and every test
then fails in a few milliseconds with `Executable doesn't exist`. Point at the installed one with
`PW_CHROMIUM_PATH=/path/to/chrome`. Do not run `playwright install`.

## What cannot pass without CI's secrets

`ENTERPRISE_LICENSE_KEY` is empty outside CI. Multi-organization is a license feature, so `/auth/signup`
answers 404 and every spec that signs up fails there: `signup.spec.ts` and the first step of
`account-shell.spec.ts`. Report those as environment failures, not regressions, and run them in CI.
RustFS needs Docker, so a spec that needs real object storage fails here too.

## Runs long

Poll a build or the suite in the foreground with an until-loop on its log; do not hand back while it
runs. `pkill -f <pattern>` matches your own shell's command line, so kill by pid.
