import { type Prisma, PrismaClient } from "@prisma/client";
import { exec } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { logger } from "@formbricks/logger";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execAsync = promisify(exec);

export interface DataMigrationContext {
  prisma: PrismaClient;
  tx: Omit<
    PrismaClient<Prisma.PrismaClientOptions, never>,
    "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
  >;
}

export interface MigrationScript {
  id?: string;
  name: string;
  run?: (context: DataMigrationContext) => Promise<void>;
  type: "data" | "schema";
}

const prisma = new PrismaClient();
const TRANSACTION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const MIGRATIONS_DIR = path.resolve(__dirname, "../../migration");
const PRISMA_MIGRATIONS_DIR = path.resolve(__dirname, "../../migrations");

const runMigrations = async (migrations: MigrationScript[]): Promise<void> => {
  logger.info(`Starting migrations: ${migrations.length.toString()} to run`);
  const startTime = Date.now();

  // empty the prisma migrations directory
  await execAsync(`rm -rf ${PRISMA_MIGRATIONS_DIR}/*`);

  for (let index = 0; index < migrations.length; index++) {
    await runSingleMigration(migrations[index], index);
  }

  const endTime = Date.now();
  logger.info(`All migrations completed in ${((endTime - startTime) / 1000).toFixed(2)}s`);
};

const runSingleMigration = async (migration: MigrationScript, index: number): Promise<void> => {
  if (migration.type === "data") {
    let hasLock = false;
    logger.info(`Running data migration: ${migration.name}`);

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
            logger.info(`Data migration ${migration.name} is pending.`);
            logger.info("Either there is another migration which is currently running or this is an error.");
            logger.info(
              "If you are sure that there is no migration running, you need to manually resolve the issue."
            );

            throw new Error("Migration is pending. Please resolve the issue manually.");
          }

          if (existingMigration?.[0]?.status === "applied") {
            logger.info(`Data migration ${migration.name} already completed. Skipping...`);
            return;
          }

          if (existingMigration?.[0]?.status === "failed") {
            logger.info(`Data migration ${migration.name} failed previously. Retrying...`);
          } else {
            // create a new data migration entry with pending status
            await prisma.$executeRaw`INSERT INTO "DataMigration" (id, name, status) VALUES (${migration.id}, ${migration.name}, 'pending')`;
            hasLock = true;
          }

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

          logger.info(`Data migration ${migration.name} completed successfully`);
        },
        { timeout: TRANSACTION_TIMEOUT }
      );
    } catch (error) {
      // Record migration failure
      logger.error(error, `Data migration ${migration.name} failed`);
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- we need to check if the migration has a lock
      if (hasLock) {
        // Mark migration as failed
        await prisma.$queryRaw`
          INSERT INTO "DataMigration" (id, name, status)
        VALUES (${migration.id}, ${migration.name}, 'failed')
          ON CONFLICT (id) DO UPDATE SET status = 'failed';
        `;
      }

      throw error;
    }
  } else {
    try {
      logger.info(`Running schema migration: ${migration.name}`);

      let copyOnly = false;

      if (index > 0) {
        const isApplied = await isSchemaMigrationApplied(migration.name, prisma);

        if (isApplied) {
          // schema migration is already applied, we can just copy the migration to the original migrations directory
          copyOnly = true;
        }
      }

      const originalMigrationsDirExists = await fs
        .access(PRISMA_MIGRATIONS_DIR)
        .then(() => true)
        .catch(() => false);

      if (!originalMigrationsDirExists) {
        await fs.mkdir(PRISMA_MIGRATIONS_DIR, { recursive: true });
      }

      // Copy specific schema migration from temp migrations directory to original migrations directory
      const migrationToCopy = await fs
        .readdir(MIGRATIONS_DIR)
        .then((files) => files.find((dir) => dir.includes(migration.name)));

      if (!migrationToCopy) {
        logger.error(`Schema migration not found: ${migration.name}`);
        return;
      }

      const sourcePath = path.join(MIGRATIONS_DIR, migrationToCopy);
      const destPath = path.join(PRISMA_MIGRATIONS_DIR, migrationToCopy);

      // Copy migration folder
      await fs.cp(sourcePath, destPath, { recursive: true });

      if (copyOnly) {
        logger.info(`Schema migration ${migration.name} copied to migrations directory`);
        return;
      }

      // Run Prisma migrate
      // throws when migrate deploy fails
      await execAsync("pnpm prisma migrate deploy");
      logger.info(`Successfully applied schema migration: ${migration.name}`);
    } catch (err) {
      logger.error(err, `Schema migration ${migration.name} failed`);
      throw err;
    }
  }
};

const loadMigrations = async (): Promise<MigrationScript[]> => {
  const migrations: MigrationScript[] = [];

  const entries = await fs.readdir(MIGRATIONS_DIR, { withFileTypes: true });

  // Filter only directories (each migration is in a directory)
  const migrationDirs = entries
    .filter((dirent) => dirent.isDirectory())
    .map((d) => d.name)
    .sort(); // Assuming timestamped names, sorting ensures the correct order

  // Separate sets for schema and data migrations
  const schemaMigrationNames = new Set<string>();
  const dataMigrationNames = new Set<string>();

  // To keep track of duplicates for error reporting
  const duplicateSchemaMigrations: string[] = [];
  const duplicateDataMigrations: string[] = [];

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

    // Extract the migration name (underscored part after timestamp)
    const migrationNameMatch = /^\d+_(?<migrationName>.+)$/.exec(dirName);
    if (!migrationNameMatch) {
      throw new Error(`Invalid migration directory name format: ${dirName}`);
    }

    const migrationName = migrationNameMatch[1];

    if (hasSchemaMigration) {
      // It's a schema migration
      if (schemaMigrationNames.has(migrationName)) {
        duplicateSchemaMigrations.push(migrationName);
      } else {
        schemaMigrationNames.add(migrationName);
      }

      // It's a schema migration
      // We just create an object with type: "schema" and name: dirName
      migrations.push({
        type: "schema",
        name: dirName,
      } as MigrationScript);
    } else if (hasDataMigration) {
      // Check for duplicates among data migrations
      if (dataMigrationNames.has(migrationName)) {
        duplicateDataMigrations.push(migrationName);
      } else {
        dataMigrationNames.add(migrationName);
      }

      // It's a data migration, dynamically import and extract the scripts
      const modulePath = path.join(migrationPath, "migration.ts");
      const mod = (await import(modulePath)) as Record<string, MigrationScript | undefined>;

      // Check each export in the module for a DataMigrationScript (type: "data")
      for (const key of Object.keys(mod)) {
        const exportedValue = mod[key];
        if (exportedValue && typeof exportedValue === "object" && exportedValue.type === "data") {
          migrations.push(exportedValue);
        }
      }
    } else {
      logger.warn(
        `Migration directory ${dirName} doesn't have migration.sql or data-migration.ts. Skipping...`
      );
    }
  }

  // If any duplicate migration names are found for the same type, throw an error
  if (duplicateSchemaMigrations.length > 0 || duplicateDataMigrations.length > 0) {
    const errorParts: string[] = [];
    if (duplicateSchemaMigrations.length > 0) {
      errorParts.push(`Schema migrations: ${duplicateSchemaMigrations.join(", ")}`);
    }
    if (duplicateDataMigrations.length > 0) {
      errorParts.push(`Data migrations: ${duplicateDataMigrations.join(", ")}`);
    }

    throw new Error(
      `Duplicate migration names found for the same type: ${errorParts.join(" | ")}. Please make sure each migration has a unique name within its type.`
    );
  }

  return migrations;
};

export async function applyMigrations(): Promise<void> {
  try {
    const allMigrations = await loadMigrations();
    logger.info(`Loaded ${allMigrations.length.toString()} migrations from ${MIGRATIONS_DIR}`);
    await runMigrations(allMigrations);
  } catch (error) {
    await prisma.$disconnect();
    throw error;
  }
}

async function isSchemaMigrationApplied(migrationName: string, prismaClient: PrismaClient): Promise<boolean> {
  try {
    const applied: unknown[] = await prismaClient.$queryRaw`
         SELECT 1
         FROM _prisma_migrations
         WHERE migration_name = ${migrationName}
           AND finished_at IS NOT NULL
         LIMIT 1;
       `;
    return applied.length > 0;
  } catch (error: unknown) {
    logger.error(error, `Failed to check migration status`);
    throw new Error(`Could not verify migration status: ${error as string}`);
  }
}
