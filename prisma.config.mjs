import "dotenv/config";

// Plain object instead of `defineConfig({...})` so the runtime image does not
// have to install `@prisma/config` and its transitive chain (`c12`, `effect`,
// `fast-check`, `valibot`, `deepmerge-ts`, ~30 modules / ~48 MB). The Prisma
// CLI accepts a default-exported config object directly; `defineConfig` is
// only a typed identity helper, and `env(name)` is sugar for
// `process.env[name]`. Both are read at CLI invocation, so behavior is
// identical for our use.

export default {
  schema: "packages/database/schema.prisma",
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
