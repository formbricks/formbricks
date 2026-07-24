import "dotenv/config";

// Plain object instead of `defineConfig({...})`. `defineConfig` is only a
// typed identity helper and `env(name)` is sugar for `process.env[name]`
// resolved at CLI invocation, so behavior is identical for our use.
//
// NOTE: this does NOT remove `@prisma/config` from the runtime image —
// the Prisma CLI itself hard-requires `@prisma/config` (and its chain:
// c12, effect, fast-check, valibot, ~30 modules / ~48 MB) at module load,
// regardless of what our config file imports. The bloat is unavoidable
// as long as `prisma migrate deploy` runs inside the container. The real
// fix is to relocate migrations to a dedicated step (K8s Job, init
// container, or CI deploy stage) and ship a runtime image with no Prisma
// CLI at all.

export default {
  schema: "packages/database/schema.prisma",
  migrations: {
    // This points at the GENERATED, git-ignored scratch dir — NOT the checked-in
    // source of truth `packages/database/migration` (singular). That directory is
    // *mixed*: schema migrations (`migration.sql`) and custom data migrations
    // (`migration.ts`) interleaved by timestamp. The migration runner copies only
    // the schema migrations here so `migrate deploy` sees a pure-SQL directory.
    // Do NOT repoint this at `packages/database/migration` — Prisma would treat the
    // data-migration dirs (tracked separately in the DataMigration table, not
    // `_prisma_migrations`) as pending SQL migrations and break. Decided in ENG-1145.
    path: "packages/database/migrations",
    seed: "tsx packages/database/src/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL,
    ...(process.env.SHADOW_DATABASE_URL && {
      shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
    }),
  },
};
