import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  // the main entry for your scheam
  schema: "./schema.prisma",
  // where migrations should be generated
  // what script to run for "prisma db seed"
  migrations: {
    path: "./migrations",
  },
  // The database URL
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});
