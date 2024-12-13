import { exec } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { type Prisma, PrismaClient } from "@prisma/client";

const execAsync = promisify(exec);

export interface DataMigrationContext {
  prisma: PrismaClient;
  tx: Omit<
    PrismaClient<Prisma.PrismaClientOptions, never>,
    "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
  >;
}

export interface DataMigrationScript {
  id?: string;
  name: string;
  run?: (context: DataMigrationContext) => Promise<void>;
  type: "data" | "schema";
}

const prisma = new PrismaClient();
const TRANSACTION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const MIGRATIONS_DIR = path.resolve(__dirname, "../../migration");

const runMigrations = async (dataMigrations: DataMigrationScript[]): Promise<void> => {
  console.log(`Starting data migrations: ${dataMigrations.length.toString()} to run`);
  const startTime = Date.now();

  for (const dataMigration of dataMigrations) {
    await runSingleMigration(dataMigration);
  }

  const endTime = Date.now();
  console.log(`All data migrations completed in ${((endTime - startTime) / 1000).toFixed(2)}s`);
};

const runSingleMigration = async (migration: DataMigrationScript): Promise<void> => {
  if (migration.type === "data") {
    console.log(`Running data migration: ${migration.name}`);

    try {
      await prisma.$transaction(
        async (tx) => {
          // Check if migration has already been run
          const existingMigration: { status: "pending" | "applied" | "failed" }[] | undefined =
            await prisma.$queryRaw`
            SELECT status FROM "DataMigration"
            WHERE id = ${migration.id}
          `;

          if (existingMigration?.[0]?.status === "pending") {
            console.log(`Data migration ${migration.name} is pending.`);
            console.log("Either there is another migration which is currently running or this is an error.");
            console.log(
              "If you are sure that there is no migration running, you need to manually resolve the issue."
            );
            process.exit(1);
          }

          if (existingMigration?.[0]?.status === "applied") {
            console.log(`Data migration ${migration.name} already completed. Skipping...`);
            return;
          }

          // create a new data migration entry with pending status
          await prisma.$executeRaw`INSERT INTO "DataMigration" (id, name, status) VALUES (${migration.id}, ${migration.name}, 'pending')`;

          if (migration.run) {
            // Run the actual migration
            await migration.run({
              prisma,
              tx,
            });

            // Mark migration as applied
            await prisma.$executeRaw`
              UPDATE "DataMigration"
              SET status = 'applied', finished_at = ${new Date()}
              WHERE id = ${migration.id};
            `;
          }

          console.log(`Data migration ${migration.name} completed successfully`);
          // fake delay:
        },
        { timeout: TRANSACTION_TIMEOUT }
      );
    } catch (error) {
      // Record migration failure
      console.error(`Data migration ${migration.name} failed:`, error);
      // Mark migration as failed
      await prisma.$queryRaw`
        INSERT INTO "DataMigration" (id, name, status)
        VALUES (${migration.id}, ${migration.name}, 'failed')
      `;
      throw error;
    }
  } else {
    console.log(`Running schema migration: ${migration.name}`);

    // Original Prisma migrations directory
    const originalMigrationsDir = path.resolve(__dirname, "../../migrations");
    // Temporary migrations directory for controlled migration
    const customMigrationsDir = path.resolve(__dirname, "../../migration");

    // TODO: Check if this can be implemented
    // // if the migration directory exists, we will check if the migration has already been applied

    // const migrationDir = path.join(originalMigrationsDir, migration.name);
    // if (fs.existsSync(migrationDir)) {
    //   // Check if there is a migration.sql file in the directory
    //   const hasSchemaMigration = fs.readdirSync(migrationDir).includes("migration.sql");
    //   if (hasSchemaMigration) {
    //     // Check if the migration has already been applied in the database
    //     const isApplied = await isSchemaMigrationApplied(migration.name, this.prisma);
    //     if (isApplied) {
    //       console.log(`Schema migration ${migration.name} already applied. Skipping...`);
    //       return;
    //     }
    //   }
    // }

    // Ensure prisma migrations directory exists
    // if (!fs.(originalMigrationsDir)) {
    //   fs.mkdirSync(originalMigrationsDir, { recursive: true });
    // }

    const originalMigrationsDirExists = await fs
      .access(originalMigrationsDir)
      .then(() => true)
      .catch(() => false);

    if (!originalMigrationsDirExists) {
      await fs.mkdir(originalMigrationsDir, { recursive: true });
    }

    // Copy specific schema migration from temp migrations directory to original migrations directory
    const migrationToCopy = await fs
      .readdir(customMigrationsDir)
      .then((files) => files.find((dir) => dir.includes(migration.name)));

    if (!migrationToCopy) {
      console.error(`Schema migration not found: ${migration.name}`);
      return;
    }

    const sourcePath = path.join(customMigrationsDir, migrationToCopy);
    const destPath = path.join(originalMigrationsDir, migrationToCopy);

    // Copy migration folder
    await fs.cp(sourcePath, destPath, { recursive: true });

    // Run Prisma migrate
    // throws when migrate deploy fails
    await execAsync("pnpm prisma migrate deploy");
    console.log(`Successfully applied schema migration: ${migration.name}`);
  }
};

const loadMigrations = async (): Promise<DataMigrationScript[]> => {
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
};

export async function applyMigrations(): Promise<void> {
  try {
    // throw new Error("Not implemented");
    const allMigrations = await loadMigrations();
    console.log(`Loaded ${allMigrations.length.toString()} migrations from ${MIGRATIONS_DIR}`);
    await runMigrations(allMigrations);
  } catch (error) {
    // console.error("Migration failed:", error);
    // process.exit(1);
    await prisma.$disconnect();
    throw error;
  }
}

// async function isSchemaMigrationApplied(migrationName: string, prisma: PrismaClient): Promise<boolean> {
//   try {
//     const applied: unknown[] = await prisma.$queryRaw`
//     SELECT 1
//     FROM _prisma_migrations
//     WHERE migration_name = ${migrationName}
//       AND finished_at IS NOT NULL
//     LIMIT 1;
//   `;
//     return applied.length > 0;
//   } catch (err) {
//     console.log("Error: ", err);
//     return false;
//   }
// }
