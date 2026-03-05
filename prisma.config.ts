import "dotenv/config";
import { defineConfig, env } from "prisma/config";

const hasShadowDatabaseUrl = Boolean(process.env.SHADOW_DATABASE_URL);

export default defineConfig({
  schema: "packages/database/schema.prisma",
  migrations: {
    path: "packages/database/migrations",
    seed: "pnpm --filter @formbricks/database db:seed",
  },
  datasource: {
    url: env("DATABASE_URL"),
    ...(hasShadowDatabaseUrl ? { shadowDatabaseUrl: env("SHADOW_DATABASE_URL") } : {}),
  },
});
