import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "../prisma";
import { createPrismaPgAdapter } from "../prisma-adapter";
import { type ExpectedMigrations, type PendingMigrations, diffPendingMigrations } from "./migration-diff";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve the checked-in migration directory the same way the runner does:
// dist/scripts -> dist/migration when built, src/scripts -> ../../migration in source.
const isBuilt = __filename.split(path.sep).includes("dist");
const MIGRATIONS_DIR = isBuilt
  ? path.resolve(__dirname, "../migration")
  : path.resolve(__dirname, "../../migration");

/**
 * Scan the shipped migration directory and classify each entry by the file it
 * contains. Intentionally does NOT import the data-migration modules: a
 * read-only startup gate must not depend on all ~22 modules resolving.
 */
const readExpectedMigrations = async (migrationsDir: string): Promise<ExpectedMigrations> => {
  const entries = await fs.readdir(migrationsDir, { withFileTypes: true });
  const dirs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const dataFileName = isBuilt ? "migration.js" : "migration.ts";
  const schema: string[] = [];
  const data: string[] = [];

  for (const dir of dirs) {
    const files = await fs.readdir(path.join(migrationsDir, dir));
    if (files.includes("migration.sql")) {
      schema.push(dir);
    } else if (files.includes(dataFileName)) {
      data.push(dir);
    }
  }

  return { schema, data };
};

/**
 * Returns the migrations that ship with this image but are not yet recorded as
 * applied in the database. Read-only; safe to run under the app's (least-
 * privilege) DATABASE_URL. Throws if the tracking tables are missing or the
 * database is unreachable — callers should treat that as "not migrated".
 */
export const getPendingMigrations = async (): Promise<PendingMigrations> => {
  const prisma = new PrismaClient({
    adapter: createPrismaPgAdapter(process.env.DATABASE_URL).adapter,
  });

  try {
    const expected = await readExpectedMigrations(MIGRATIONS_DIR);

    const appliedSchemaRows = await prisma.$queryRaw<{ migration_name: string }[]>`
      SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL
    `;
    const appliedDataRows = await prisma.$queryRaw<{ name: string }[]>`
      SELECT name FROM "DataMigration" WHERE status = 'applied'
    `;

    return diffPendingMigrations(
      expected,
      new Set(appliedSchemaRows.map((row) => row.migration_name)),
      new Set(appliedDataRows.map((row) => row.name))
    );
  } finally {
    await prisma.$disconnect();
  }
};
