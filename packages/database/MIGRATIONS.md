# Database migrations

Formbricks uses **Prisma** for schema migrations and a **custom runner** for data
migrations, and interleaves the two. This document explains the layout, why it looks
unusual, and why the "obvious simplification" (point Prisma directly at the checked-in
directory) is unsafe. It records the outcome of the [ENG-1145](https://linear.app/formbricks/issue/ENG-1145)
evaluation.

## TL;DR

- `packages/database/migration/` (**singular**, checked in) is the **source of truth**. It is a
  **mixed** directory: schema migrations (`migration.sql`) and custom data migrations
  (`migration.ts`) live side by side, ordered by their timestamp prefix.
- `packages/database/migrations/` (**plural**, git-ignored) is a **generated scratch** directory.
  The runner wipes it and copies schema migrations into it on demand so that
  `prisma migrate deploy` sees a _pure_ Prisma directory. `prisma.config.mjs` points
  `migrations.path` here.
- **Do not** point Prisma at `migration/` directly and **do not** split the directory. The
  copy step is load-bearing (see [Why the copy step exists](#why-the-copy-step-exists)).

## How it works

The runner is [`src/scripts/migration-runner.ts`](src/scripts/migration-runner.ts), invoked via
[`src/scripts/apply-migrations.ts`](src/scripts/apply-migrations.ts) (`pnpm db:migrate:deploy`).

1. It reads every directory under `migration/`, sorted by the timestamp prefix, and classifies
   each as **schema** (`migration.sql`) or **data** (`migration.ts`).
2. It applies them **in one timestamp order, interleaved**:
   - **schema** → the runner copies that single migration into the scratch `migrations/`
     directory and runs `prisma migrate deploy`. Prisma records it in `_prisma_migrations`.
   - **data** → the runner imports the module and runs it inside a transaction, tracking it in
     the custom **`DataMigration`** table (`id`, `name`, `status`).
3. Schema state lives in Prisma's `_prisma_migrations`; data state lives in `DataMigration`.
   The two tracks are applied together but tracked separately.

Interleaving is required because data migrations depend on the schema state at their point in
history — e.g. `20260401000000_add_workspace_id_…` (schema) adds a column that
`20260401000002_backfill_workspace_id` (data) then backfills; a later schema migration may drop
the old column. Reordering the two tracks would break these dependencies.

## Why the copy step exists

`prisma migrate deploy` only understands a directory of **pure SQL** migrations (each subdir has
a `migration.sql`, plus `migration_lock.toml`). The checked-in `migration/` directory is **not**
that — it also contains `migration.ts` data-migration directories that Prisma knows nothing
about, and whose applied-state lives in `DataMigration`, not `_prisma_migrations`.

Pointing Prisma directly at the mixed directory is not viable. Verified with
`prisma migrate status --config <config pointing at migration/>` against a fully-migrated
database: Prisma reports **every data-migration directory as an unapplied migration** (they are
absent from `_prisma_migrations`), e.g.

```text
20251118032116_migrate_questions_to_blocks
20260401000002_backfill_workspace_id
20260416110000_backfill_legacy_sso_accounts
…
To apply migrations in production run prisma migrate deploy.
```

A `migrate deploy` there would then try to apply those directories as schema migrations — but
they have no `migration.sql`, so it would fail or mis-track. The scratch-copy is what presents
Prisma a clean, SQL-only view while the runner keeps the interleaved data migrations on their own
track.

## Decision (ENG-1145): keep the copy step

The evaluation confirmed the current model is correct as-is. The alternatives were rejected:

- **Point `migrations.path` at `migration/` directly** — breaks, as shown above (Prisma treats
  data-migration dirs as pending SQL migrations).
- **Split schema and data into separate directories** — breaks the interleaved dependencies
  (a data backfill that must run between two schema migrations could no longer be ordered
  correctly).

### Validation performed

Against a throwaway `pgvector/pgvector:pg18` database, using the built runner:

| Check                           | Result                                                                                                         |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Mixed-directory behavior (AC1)  | Prisma lists all data-migration dirs as pending — direct use not viable                                        |
| Empty-DB deploy (AC2)           | Applies all schema + data migrations, exit 0                                                                   |
| Existing-DB upgrade (AC3)       | Older release deployed, then restoring newer migrations applies only the pending ones, exit 0                  |
| Second-deploy idempotency (AC4) | No-op; no data-migration bodies run; tracking tables unchanged                                                 |
| `prisma migrate status` (AC5)   | Sees the pure scratch dir; "Database schema is up to date"                                                     |
| Data-migration ordering (AC6)   | Applied order (from `_prisma_migrations` + `DataMigration` timestamps) shows schema/data correctly interleaved |

## Authoring migrations

- **Schema migration**: `pnpm --filter @formbricks/database create-migration` — generates a
  `migration.sql` directory under `migration/`.
- **Data migration**: `pnpm --filter @formbricks/database generate-data-migration` — scaffolds a
  timestamped `migration.ts` under `migration/`. Its exported `name` must equal the directory
  name (the migration runner keys on this).

## Future direction (out of scope for ENG-1145)

The interleaved runner is a homegrown design; the idiomatic Prisma-ecosystem model is a
**two-track** system (schema via `migrate deploy`, data via a separate ordered runner) that relies
on **expand/contract** discipline so every data migration is safe to run _after_ all pending
schema migrations. Moving to that model would let Prisma own a _pure_ directory with no copy step,
but it requires reworking the existing order-dependent data migrations and a one-time baseline —
a larger, separate effort, not this cleanup.
