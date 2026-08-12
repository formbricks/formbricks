# Local test environment (no Docker)

`scripts/setup-local-test-env.sh` takes a fresh machine from zero to a running dev server with
seeded data, ready for Playwright. It exists for sandboxes and CI containers where Docker images
cannot be pulled.

```bash
bash scripts/setup-local-test-env.sh
```

Result: `http://localhost:3000`, logged in as `admin@formbricks.com` / `Password#123`.

**On a machine with working Docker, use `pnpm db:up` instead.** It brings up Mailhog, RustFS,
Cube and Hub, none of which this script can provide.

## What it does, and why each step is there

| Step                                      | Why it is not obvious                                                                           |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Install pgvector                          | Required by migration history, invisible in `schema.prisma`. See below.                         |
| Start PostgreSQL, set password, create DB | The packaged cluster starts down with peer auth only; `DATABASE_URL` needs TCP + password.      |
| Start Redis                               | Stands in for Valkey from the compose stack.                                                    |
| `scripts/setup-dev-env.sh`                | Generates the four required secrets. `apps/web/.env` is a symlink to the root `.env`.           |
| `pnpm build --filter=@formbricks/web^...` | The web app imports workspace packages from `dist/`, and turbo's `dev` task has no `dependsOn`. |
| Shim Playwright browsers                  | The pinned Chromium build rarely matches what a sandbox pre-provisioned.                        |
| `pnpm db:migrate:dev` then `pnpm db:seed` | Seeding skips the entire onboarding wizard.                                                     |
| Start dev server                          | `playwright.config.ts` has no `webServer` block, so specs assume `:3000` is already up.         |

## The two traps worth knowing

**pgvector is required, and nothing in the current schema says so.** Migration
`20241017124431_add_documents_and_insights` runs `CREATE EXTENSION vector`, and migrations replay
history. A stock cluster fails partway through:

```
Error: P3018   Migration name: 20241017124431_add_documents_and_insights
Database error code: 0A000
ERROR: extension "vector" is not available
```

The compose stack hides this by using the `pgvector/pgvector` image. Anything else — a hand-rolled
cluster, or a managed Postgres without the extension — hits it.

**A failed migration is sticky.** Prisma records it in `_prisma_migrations` and refuses to
continue, so installing pgvector afterwards changes nothing and the identical error repeats. You
have to drop the database:

```bash
su postgres -c "dropdb --if-exists formbricks && createdb formbricks"
pnpm db:migrate:dev
```

Install pgvector _before_ the first migrate and neither trap fires.

## Seeded data

`pnpm db:seed` creates three users sharing the password `Password#123` —
`admin@formbricks.com`, `manager@formbricks.com`, `member@formbricks.com` — plus an organization,
a workspace, and several surveys in different states (draft, in-progress, completed). IDs are fixed
in `packages/database/src/seed/constants.ts`, so tests can reference them directly.

## What is missing without Docker

Nothing here blocks the app from booting, but each removes a feature area from local testing.

| Service      | Port        | Untestable without it                                                   |
| ------------ | ----------- | ----------------------------------------------------------------------- |
| Mailhog      | 8025 / 1025 | Email delivery and inbox assertions — invites, verification, follow-ups |
| RustFS (S3)  | 9000 / 9001 | File and image uploads, storage-backed survey assets                    |
| Cube         | 4000        | Analytics dashboards and charts                                         |
| Hub + worker | 8080        | AI enrichment, embeddings, insights, async jobs                         |

## Known noise

- **Edge Runtime warnings from `packages/logger`.** `process.on` / `process.off` are unsupported in
  the Edge Runtime, reached via `apps/web/instrumentation.ts`. This lights up the red "1 Issue"
  badge in the dev overlay. Present on `main`; not a setup problem.
- **`Failed to load Formbricks SDK` / `ERR_TUNNEL_CONNECTION_FAILED`.** The app fetches its own
  widget from `app.formbricks.com`. Expected wherever egress is restricted.
- **First page load takes ~50s.** Turbopack compiling on demand, not a hang. Warm loads are ~0.1s.

## Logs

Every step writes to `.local-test-logs/` — `install.log`, `build.log`, `migrate.log`, `seed.log`,
`dev-server.log`. Start there when a step fails.
