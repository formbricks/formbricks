import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { type DataMigrationScript, MigrationRunner } from "../types/migration-runner";

const prisma = new PrismaClient();
const migrationRunner = new MigrationRunner(prisma);

const MIGRATIONS_DIR = path.resolve(__dirname, "../migration");

async function loadMigrations(): Promise<DataMigrationScript[]> {
  const migrations: DataMigrationScript[] = [];

  const entries = await fs.readdir(MIGRATIONS_DIR, { withFileTypes: true });

  // Filter only directories (each migration is in a directory)
  const migrationDirs = entries
    .filter((dirent) => dirent.isDirectory())
    .map((d) => d.name)
    .sort(); // Assuming timestamped names, sorting ensures the correct order

  for (const dirName of migrationDirs) {
    const migrationPath = path.join(MIGRATIONS_DIR, dirName);
    const files = await fs.readdir(migrationPath);

    const hasSchemaMigration = files.includes("migration.sql");
    const hasDataMigration = files.includes("migration.ts");

    if (hasSchemaMigration && hasDataMigration) {
      throw new Error(
        `Migration directory ${dirName} has both migration.sql and migration.ts. This should not happen.`
      );
    }

    if (hasSchemaMigration) {
      // It's a schema migration
      // We just create an object with type: "schema" and name: dirName
      migrations.push({
        type: "schema",
        name: dirName,
      } as DataMigrationScript);
    } else if (hasDataMigration) {
      // It's a data migration, dynamically import and extract the scripts
      const modulePath = path.join(migrationPath, "migration.ts");
      const mod = (await import(modulePath)) as Record<string, DataMigrationScript | undefined>;

      // Check each export in the module for a DataMigrationScript (type: "data")
      for (const key of Object.keys(mod)) {
        const exportedValue = mod[key];
        if (exportedValue && typeof exportedValue === "object" && exportedValue.type === "data") {
          migrations.push(exportedValue);
        }
      }
    } else {
      console.warn(
        `Migration directory ${dirName} doesn't have migration.sql or data-migration.ts. Skipping...`
      );
    }
  }

  return migrations;
}

async function applyMigrations(): Promise<void> {
  try {
    const allMigrations = await loadMigrations();

    console.log(`Loaded ${allMigrations.length.toString()} migrations from ${MIGRATIONS_DIR}`);

    await migrationRunner.runMigrations(allMigrations);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

applyMigrations().catch((error: unknown) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
