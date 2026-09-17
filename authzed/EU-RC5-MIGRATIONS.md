# EU rc.5 migration manifest

Temporary Cloud release procedure, not a general migration selector. No production migrations have
been applied by this work. Source: `c5c6ed5f0944f310990e98629419ee9ef602dbc1`; target:
`ac7bf6f2104e37b7e0299ddaa5f752f04b3e59a3`.

## Live baseline verified on 2026-09-17

All 167 v5 source SQL migrations match EU's applied names and SHA-256 checksums. No missing, unknown,
failed, or checksum-drifted SQL migrations were found. The latest data migration is
`20260821165535_repair_account_issuer`, applied. The existing language-code migration's rc.5 change is
an import-path correction; its already-applied data transformation must not be rerun.

EU uses PostgreSQL 17.7. The read-only inventory found 79,269 surveys, 3,060 with legacy embedded-data
declarations, and 58 charts (13 `line`). No survey contents, customer identifiers or credentials were
copied. Four v5.4.2 application replicas and three private SpiceDB replicas were ready.

## Ordered phases

| Migration                                                                | Phase                             | Gate                                                                                     |
| ------------------------------------------------------------------------ | --------------------------------- | ---------------------------------------------------------------------------------------- |
| `20260806000000_add_embedded_data_tables`                                | Expansion                         | Empty tables/indexes; referenced-table locks bounded by the existing five-second timeout |
| `20260817000000_add_survey_is_anonymize_responses_enabled`               | Expansion                         | Metadata-only false default; existing five-second lock timeout                           |
| `20260818120000_add_authzed_projection_outbox`                           | Expansion                         | Queue plus 11 source triggers; supply session lock/statement limits and monitor overhead |
| `20260820000000_add_response_ingest_flags`                               | Expansion                         | Nullable metadata-only column; existing five-second lock timeout                         |
| `20260812121944_backfill_embedded_data`                                  | Product-write pause before bridge | Freeze survey edits and other product writers until every original v5 writer drains      |
| `20260825000000_remove_is_single_response_per_email_enabled_from_survey` | Contraction after v5 drains       | Original v5 selects this column; do not run with any original v5 workload alive          |
| `20260826120000_eng_2612_merge_line_chart_type_into_area`                | Contraction after v5 drains       | Chart rewrite and enum replacement; require bounded lock wait and rehearsed duration     |

The expansion subset intentionally runs later additive schema changes before the older embedded-data
backfill. They have no dependency on that backfill; this exact ordering is tested with the existing
migration runner. The original names and SQL bytes are preserved. All remaining migrations execute
normally; neither tool writes synthetic completion records. Fresh-database baselining is used only by
the runner on an empty disposable v5 fixture, before test data is inserted.

Use `PGOPTIONS='-c lock_timeout=5000 -c statement_timeout=120000'` for rehearsal of unbounded statements;
retain a reviewed bounded setting for production after measured timing. A timeout or partially failed
migration stops the procedure. Inspect and recover using the existing migration runbook, not a blind
retry or an invented success marker. The outbox migration contains multiple statements and no explicit
transaction; its failure must be inspected even though statements are written to be rerunnable.

## Build the restricted artifact

After the exact bridge dependency build, run from its clean checkout:

```bash
node scripts/cloud-bridge/build-migration-artifact.mjs expansion /new/path/expansion
node scripts/cloud-bridge/build-migration-artifact.mjs bridge /new/path/bridge
node scripts/cloud-bridge/build-migration-artifact.mjs final /new/path/final
```

Each output contains historical migrations plus the explicitly reviewed subset, and a manifest with
source checksums. Existing output directories, changed migration source, changed historical SQL, or
unexpected release migrations are rejected. The runtime runner is unchanged. `v5-fixture` exists only
for the disposable local rehearsal and must never be used for a production Job.

Package each subset using `scripts/cloud-bridge/Dockerfile.migrations`, an `artifact/` build-context
directory containing its output, and `BRIDGE_IMAGE` pinned to the approved bridge digest. The Dockerfile
removes the base image's complete migration directory before copying the subset: copying over it would
leave excluded destructive migrations present. Verify the packaged manifest and directory contents,
record a separate digest for each artifact, and use explicit operations Jobs. No image is approved
merely because the packaging script succeeds.

Application pods use `SKIP_STARTUP_MIGRATION=true`; automatic chart migration hooks must also remain
disabled during the controlled transition. Never run the unrestricted rc.5 runner with original v5
pods, or use the all-writers-stopped self-hosted prepare wrapper while respondent submissions stay live.
Before normal rc.5 rollout, its ordinary runner must report no pending migrations.

## Temporary chart compatibility

Only the bridge Prisma client recognizes the old `line` enum. It normalizes it to `area` plus
`config.areaDisplay="line"` at chart and nested dashboard reads. Edits and duplication write only the
new representation. Public chart inputs still reject `line`. The canonical SQL migration is unchanged.
Never use `prisma db push` from this bridge: its temporary read enum deliberately differs from the final
database. Remove the branch/artifacts at retirement, not the normal v6 schema.

## Local evidence and remaining gates

```bash
node scripts/cloud-bridge/rehearse-migrations.mjs
pnpm --filter @formbricks/web exec vitest run --config vitest.bridge.config.mts
```

The disposable PostgreSQL 17 run applied complete v5 SQL history on an empty database, inserted synthetic
legacy data, then executed expansion, backfill and contraction through the normal runner. It verified
transactional outbox rollback/commit, final-write-before-backfill capture, chart style preservation,
survey-column removal and organization cascade events. All passed. Small-fixture times were 4.26s for
initial history, 1.18s expansion, 0.33s backfill phase and 0.82s contraction phase. These are **not** a
production-sized timing promise. The separate 17 PostgreSQL tests include chart reads before/after the
exact canonical enum migration and the authorization matrix.

Still required: immutable image tests; EU-sized data/load rehearsal; every writer/pause-path inventory;
real old/new browser sessions, Server Actions and assets; accepted-response reconciliation; exact
bridge/rc.5 rollback and forward recovery; backup verification; approved soak windows. Production
promotion remains blocked until these gates pass.

## New migration source checksums

| Migration suffix                                          | SHA-256 of `migration.sql` (or the backfill's `migration.ts`)      |
| --------------------------------------------------------- | ------------------------------------------------------------------ |
| `add_embedded_data_tables`                                | `24b4d6676ef806f82aa0a86c3f8e26d5222eaa7e4a226765f9c6c187986a1b40` |
| `backfill_embedded_data`                                  | `8066ee2e2fc92dde75d492f67498b2da22a93f22d81e9d5918119a96b901878b` |
| `add_survey_is_anonymize_responses_enabled`               | `41b0d717ed6ea7d89f7d3a4c5fdffe1d00be7f8f3168a7672534a5545bed5a38` |
| `add_authzed_projection_outbox`                           | `c58a0ff8ad3a48a43a3034722aa8ab671a7dd3ecc9218808895dde5c8149f95c` |
| `add_response_ingest_flags`                               | `1231cc5f694fca80eb193466a84fa459f69706d9872306d2082f13f3bcd6eecf` |
| `remove_is_single_response_per_email_enabled_from_survey` | `51e43ff85e9d211f5e69cc9a9e62ec1b80533d0dd640fc95193366fe881c0e8d` |
| `eng_2612_merge_line_chart_type_into_area`                | `d69a710ca1fb2c97a8b2651054c05a8f673b628cd485a92b465631700b164408` |
