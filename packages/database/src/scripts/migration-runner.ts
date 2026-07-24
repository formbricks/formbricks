import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { logger } from "@formbricks/logger";
import { Prisma, PrismaClient } from "../prisma";
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
const getMigrationDatabaseUrl = (): string | undefined => {
  const migrateDatabaseUrl = process.env.MIGRATE_DATABASE_URL;
  return migrateDatabaseUrl !== undefined && migrateDatabaseUrl.trim() !== ""
    ? migrateDatabaseUrl
    : process.env.DATABASE_URL;
};

const migrationDatabaseUrl = getMigrationDatabaseUrl();
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

// Postgres error codes that mean "this database has never been migrated": the
// database itself doesn't exist yet (`3D000`, when `migrate deploy` will create
// it), or it exists but the `_prisma_migrations` table hasn't been created yet
// (`42P01`). The startup lookups below run BEFORE the first `migrate deploy`, so
// on a truly fresh target they hit one of these — we treat both as "nothing
// applied". Depending on the Prisma driver adapter the code surfaces in
// different places: directly on the error's `code` (raw pg), nested under
// `meta.driverAdapterError.cause` (Prisma wraps it as a generic `P2010`), or —
// as a last resort — in the message. We check all three so a fresh DB is
// reliably recognised.
const PG_UNDEFINED_TABLE = "42P01";
const PG_INVALID_CATALOG_NAME = "3D000";
const FRESH_DATABASE_PG_CODES = [PG_UNDEFINED_TABLE, PG_INVALID_CATALOG_NAME];
const FRESH_DATABASE_ADAPTER_KINDS = ["TableDoesNotExist", "DatabaseDoesNotExist"];

const isFreshDatabaseError = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const err = error as {
    code?: unknown;
    meta?: { driverAdapterError?: { cause?: { originalCode?: unknown; kind?: unknown } } };
    message?: unknown;
  };

  if (typeof err.code === "string" && FRESH_DATABASE_PG_CODES.includes(err.code)) {
    return true;
  }

  const cause = err.meta?.driverAdapterError?.cause;
  if (
    (typeof cause?.originalCode === "string" && FRESH_DATABASE_PG_CODES.includes(cause.originalCode)) ||
    (typeof cause?.kind === "string" && FRESH_DATABASE_ADAPTER_KINDS.includes(cause.kind))
  ) {
    return true;
  }

  const message = err.message;
  return typeof message === "string" && FRESH_DATABASE_PG_CODES.some((code) => message.includes(code));
};

// Load the set of schema migrations already recorded as fully applied in
// `_prisma_migrations`. We only ever read this once, before running anything:
// `prisma migrate deploy` is idempotent, so a migration missing from this
// snapshot simply gets (re)deployed, and re-applying an already-applied folder
// is a no-op. The `finished_at IS NOT NULL` predicate excludes failed/partial
// migrations so their batch is redeployed rather than silently skipped.
const loadAppliedSchemaMigrations = async (): Promise<Set<string>> => {
  try {
    const rows: { migration_name: string }[] = await prisma.$queryRaw`
      SELECT migration_name
      FROM _prisma_migrations
      WHERE finished_at IS NOT NULL
    `;
    return new Set(rows.map((row) => row.migration_name));
  } catch (error: unknown) {
    // Fresh database: the DB doesn't exist yet, or exists without a
    // `_prisma_migrations` table. Treat as "nothing applied" and let the first
    // `migrate deploy` create the database/table. Any other error is a real
    // fault (e.g. connectivity) and must not be swallowed — otherwise we'd
    // misread it as an empty DB and needlessly redeploy every migration.
    if (isFreshDatabaseError(error)) {
      return new Set<string>();
    }

    logger.error(error, "Failed to load applied schema migrations");
    throw error;
  }
};

// Count data migrations already recorded in the DataMigration table. Returns 0
// when the database or the table doesn't exist yet (fresh DB — the table is
// created by a schema migration). Used to decide whether the fresh-database
// fast path applies.
const countRecordedDataMigrations = async (): Promise<number> => {
  try {
    const rows: { count: bigint }[] =
      await prisma.$queryRaw`SELECT COUNT(*)::bigint AS count FROM "DataMigration"`;
    return Number(rows[0]?.count ?? 0n);
  } catch (error: unknown) {
    if (isFreshDatabaseError(error)) {
      return 0;
    }

    logger.error(error, "Failed to count recorded data migrations");
    throw error;
  }
};

// Record data migrations as applied WITHOUT running them. On a fresh database
// there is no data to transform, so every data migration is a no-op; several
// older ones also reference columns/tables dropped by later schema migrations,
// so they cannot even execute against the final schema. Baselining writes the
// exact end-state a successful `runDataMigration` leaves (status 'applied' +
// finished_at), so a later normal run sees them applied and skips. This is a
// single atomic INSERT: it commits all rows or none, so an interrupted fast
// path is safely resumed by the trigger in `runMigrations`.
const baselineDataMigrations = async (dataMigrations: MigrationScript[]): Promise<void> => {
  if (dataMigrations.length === 0) {
    return;
  }

  const finishedAt = new Date();
  const rows = dataMigrations.map(
    (migration) => Prisma.sql`(${migration.id}, ${migration.name}, 'applied', ${finishedAt})`
  );

  await prisma.$executeRaw`
    INSERT INTO "DataMigration" ("id", "name", "status", "finished_at")
    VALUES ${Prisma.join(rows)}
    ON CONFLICT ("id") DO NOTHING
  `;

  logger.info(
    `Baselined ${dataMigrations.length.toString()} data migration(s) as applied without running them`
  );
};

const runMigrations = async (migrations: MigrationScript[]): Promise<void> => {
  logger.info(`Starting migrations: ${migrations.length.toString()} to run`);
  const startTime = Date.now();

  // packages/database/migration is the source of truth (checked in). We copy
  // each schema migration into packages/database/migrations on demand for
  // `prisma migrate deploy`, then wipe between runs so stale or experimental
  // migrations from a previous local invocation can't influence this one.
  await fs.rm(PRISMA_MIGRATIONS_DIR, { recursive: true, force: true });
  await fs.mkdir(PRISMA_MIGRATIONS_DIR, { recursive: true });

  const appliedSchemaMigrations = await loadAppliedSchemaMigrations();

  const schemaMigrations = migrations.filter((migration) => migration.type === "schema");
  const dataMigrations = migrations.filter((migration) => migration.type === "data");

  // Fresh-database fast path. On a brand-new DB there is no data, so every data
  // migration is a guaranteed no-op — apply the ENTIRE schema history in a
  // single `migrate deploy` and baseline the data migrations without running
  // them, instead of interleaving (which needs one deploy per contiguous schema
  // segment). It triggers when no data migration has been recorded yet AND
  // either the DB is untouched (no schema applied) or the full schema is already
  // present. The second case makes the path resume-safe: if a previous fast run
  // was interrupted between the schema deploy and the (atomic) baseline INSERT,
  // this re-runs it — the deploy is a no-op and the baseline is idempotent —
  // rather than falling through to the interleaved path, which would try to run
  // data migrations against the final schema (some reference dropped columns and
  // would fail). A normal partial upgrade always has recorded data migrations,
  // so it never matches. Invariant: data migrations must be no-ops on an empty
  // DB (see README) — seed essential data via the seed script, not a migration.
  if (dataMigrations.length > 0) {
    const recordedDataMigrations = await countRecordedDataMigrations();
    const allSchemaApplied = schemaMigrations.every((migration) =>
      appliedSchemaMigrations.has(migration.name)
    );

    if (recordedDataMigrations === 0 && (appliedSchemaMigrations.size === 0 || allSchemaApplied)) {
      logger.info(
        `Fresh database detected: applying ${schemaMigrations.length.toString()} schema migrations in a single batch and baselining ${dataMigrations.length.toString()} data migrations without running them`
      );

      // Applies all pending schema migrations in one `migrate deploy` (also
      // creates the DataMigration table the baseline writes to). On resume,
      // every schema migration is already applied so this is copy-only.
      await runSchemaMigrationBatch(schemaMigrations, appliedSchemaMigrations);
      await baselineDataMigrations(dataMigrations);

      const endTime = Date.now();
      logger.info(`All migrations completed in ${((endTime - startTime) / 1000).toFixed(2)}s`);
      return;
    }
  }

  // Data and schema migrations are interleaved by timestamp and must run in
  // that exact order. But `prisma migrate deploy` applies every pending
  // migration in the migrations directory in one shot, so we can collapse a
  // run of *consecutive* schema migrations into a single deploy call instead of
  // spawning the Prisma CLI once per migration (which dominated runtime on
  // empty DBs). We flush the accumulated schema batch right before each data
  // migration — and once more at the end — which preserves ordering exactly:
  // consecutive schema migrations are, by definition, not separated by a data
  // migration, so batching them cannot reorder anything.
  let schemaBatch: MigrationScript[] = [];

  const flushSchemaBatch = async (): Promise<void> => {
    if (schemaBatch.length === 0) {
      return;
    }

    await runSchemaMigrationBatch(schemaBatch, appliedSchemaMigrations);
    schemaBatch = [];
  };

  for (const migration of migrations) {
    if (migration.type === "schema") {
      schemaBatch.push(migration);
    } else {
      await flushSchemaBatch();
      await runDataMigration(migration);
    }
  }

  await flushSchemaBatch();

  const endTime = Date.now();
  logger.info(`All migrations completed in ${((endTime - startTime) / 1000).toFixed(2)}s`);
};

const runDataMigration = async (migration: MigrationScript): Promise<void> => {
  let hasLock = false;
  logger.info(`Running data migration: ${migration.name}`);

  try {
    await prisma.$transaction(
      async (tx) => {
        // All DataMigration bookkeeping runs on `tx` (not the outer `prisma`
        // client) so the status transitions commit atomically with the changes
        // migration.run makes through `tx`. If the transaction rolls back, the
        // "applied" marker rolls back with it — a migration can never be
        // recorded applied while its data changes are discarded. The failure
        // path below intentionally stays on `prisma`, since it must persist
        // after the transaction has already rolled back.

        // Check if migration has already been run
        const existingMigration: { status: "pending" | "applied" | "failed" }[] | undefined =
          await tx.$queryRaw`
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
          await tx.$executeRaw`INSERT INTO "DataMigration" (id, name, status) VALUES (${migration.id}, ${migration.name}, 'pending')`;
          hasLock = true;
        }

        if (migration.run) {
          // Run the actual migration
          await migration.run({
            prisma,
            tx,
          });

          // Mark migration as applied
          await tx.$executeRaw`
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
};

// Applies a contiguous run of schema migrations with a single
// `prisma migrate deploy` call. `prisma migrate deploy` scans the whole
// migrations directory, applies every pending migration in timestamp order and
// skips ones already recorded in `_prisma_migrations`, so one call per batch is
// equivalent to (but far cheaper than) one call per migration.
const runSchemaMigrationBatch = async (
  batch: MigrationScript[],
  appliedSchemaMigrations: Set<string>
): Promise<void> => {
  if (batch.length === 0) {
    return;
  }

  const batchNames = batch.map((migration) => migration.name);
  logger.info(`Running schema migration batch (${batch.length.toString()}): ${batchNames.join(", ")}`);

  try {
    const sourceDirs = await fs.readdir(MIGRATIONS_DIR);

    // Always copy every folder in the batch into the scratch migrations dir —
    // even the already-applied ones. A later batch's `migrate deploy` runs
    // against this accumulated directory, and Prisma treats a migration recorded
    // in `_prisma_migrations` but missing from the directory as a divergence
    // error. So the directory must always mirror the applied history.
    for (const migration of batch) {
      const migrationToCopy = sourceDirs.find((dir) => dir.includes(migration.name));

      if (!migrationToCopy) {
        logger.error(`Schema migration not found: ${migration.name}`);
        return;
      }

      const sourcePath = path.join(MIGRATIONS_DIR, migrationToCopy);
      const destPath = path.join(PRISMA_MIGRATIONS_DIR, migrationToCopy);
      await fs.cp(sourcePath, destPath, { recursive: true });
    }

    // If every migration in this batch is already applied there is nothing to
    // deploy — the copy above is enough to keep the directory consistent for
    // later batches. This keeps steady-state runs (e.g. a fully-migrated
    // production container restart) from spawning the Prisma CLI at all.
    const allApplied = batch.every((migration) => appliedSchemaMigrations.has(migration.name));

    if (allApplied) {
      logger.info(`Schema migration batch already applied; copied ${batch.length.toString()} migration(s)`);
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
    logger.info(`Successfully applied schema migration batch (${batch.length.toString()})`);
  } catch (err) {
    logger.error(err, `Schema migration batch failed: ${batchNames.join(", ")}`);
    throw err;
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
