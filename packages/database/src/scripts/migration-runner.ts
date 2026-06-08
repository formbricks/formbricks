import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { logger } from "@formbricks/logger";
import { PrismaClient } from "../prisma";
import { createPrismaPgAdapter } from "../prisma-adapter";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execFileAsync = promisify(execFile);

export interface DataMigrationContext {
  prisma: PrismaClient;
  tx: Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;
}

export interface MigrationScript {
  id?: string;
  name: string;
  run?: (context: DataMigrationContext) => Promise<void>;
  type: "data" | "schema";
}

// MIGRATE_DATABASE_URL is scoped to this migration runner. prisma.config.mjs
// always reads DATABASE_URL so normal Prisma CLI commands (generate, format,
// db push from a developer shell) do not unexpectedly target the elevated-
// privilege migration database. When this runner spawns `prisma migrate
// deploy` below, we explicitly inject the resolved URL into the child env so
// the subprocess's prisma.config.mjs resolves to the same database.
const migrationDatabaseUrl = process.env.MIGRATE_DATABASE_URL || process.env.DATABASE_URL;
const prisma = new PrismaClient({ adapter: createPrismaPgAdapter(migrationDatabaseUrl).adapter });
const TRANSACTION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

// Determine if we're running from built or source code
const isBuilt = __filename.split(path.sep).includes("dist");
const MIGRATIONS_DIR = isBuilt
  ? path.resolve(__dirname, "../migration") // From dist/scripts to dist/migration
  : path.resolve(__dirname, "../../migration"); // From src/scripts to migration
const PRISMA_MIGRATIONS_DIR = path.resolve(__dirname, "../../migrations");
const DATABASE_PACKAGE_DIR = isBuilt ? path.resolve(__dirname, "../..") : path.resolve(__dirname, "../..");
const REPO_ROOT_DIR = path.resolve(DATABASE_PACKAGE_DIR, "../..");
const PRISMA_CONFIG_PATH = path.join(REPO_ROOT_DIR, "prisma.config.mjs");
const LOCAL_PRISMA_BIN = path.join(REPO_ROOT_DIR, "node_modules", ".bin", "prisma");

// Prefer the workspace-local prisma binary; fall back to PATH for Docker
// runtimes where prisma is installed globally and node_modules/.bin is absent.
const resolvePrismaBin = async (): Promise<string> => {
  try {
    await fs.access(LOCAL_PRISMA_BIN);
    return LOCAL_PRISMA_BIN;
  } catch {
    return "prisma";
  }
};

const runMigrations = async (migrations: MigrationScript[]): Promise<void> => {
  logger.info(`Starting migrations: ${migrations.length.toString()} to run`);
  const startTime = Date.now();

  // packages/database/migration is the source of truth (checked in). We copy
  // each migration into packages/database/migrations on demand for
  // `prisma migrate deploy`, then wipe between runs so stale or experimental
  // migrations from a previous local invocation can't influence this one.
  await fs.rm(PRISMA_MIGRATIONS_DIR, { recursive: true, force: true });
  await fs.mkdir(PRISMA_MIGRATIONS_DIR, { recursive: true });

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

      // Run Prisma migrate. Throws when migrate deploy fails.
      // We pin DATABASE_URL on the child env to the same URL the in-process
      // PrismaClient resolved above. prisma.config.mjs always reads
      // env("DATABASE_URL"), so this is how MIGRATE_DATABASE_URL reaches the
      // subprocess without leaking into the parent's env.
      const prismaBin = await resolvePrismaBin();
      await execFileAsync(prismaBin, ["migrate", "deploy", "--config", PRISMA_CONFIG_PATH], {
        cwd: REPO_ROOT_DIR,
        env: { ...process.env, DATABASE_URL: migrationDatabaseUrl },
      });
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
    // Check for the appropriate data migration file extension based on build status
    const dataMigrationFileName = isBuilt ? "migration.js" : "migration.ts";
    const hasDataMigration = files.includes(dataMigrationFileName);

    if (hasSchemaMigration && hasDataMigration) {
      throw new Error(
        `Migration directory ${dirName} has both migration.sql and ${dataMigrationFileName}. This should not happen.`
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
      // Use .js extension when running from built code, .ts when running from source
      const modulePath = path.join(migrationPath, dataMigrationFileName);
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
        `Migration directory ${dirName} doesn't have migration.sql or ${dataMigrationFileName}. Skipping...`
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
    logger.info(
      `Loaded ${allMigrations.length.toString()} migrations from ${MIGRATIONS_DIR} (source: ${
        isBuilt ? "dist" : "src"
      })`
    );
    await runMigrations(allMigrations);
  } finally {
    await prisma.$disconnect();
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
