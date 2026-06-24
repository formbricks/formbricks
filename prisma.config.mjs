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
  schema: "packages/database/schema",
  migrations: {
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
