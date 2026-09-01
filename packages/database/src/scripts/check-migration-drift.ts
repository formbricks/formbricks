import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATABASE_PACKAGE_DIR = path.resolve(__dirname, "../..");
const REPO_ROOT_DIR = path.resolve(DATABASE_PACKAGE_DIR, "../..");
const MIGRATIONS_DIR = path.join(DATABASE_PACKAGE_DIR, "migration");
const SCHEMA_DIR = path.join(DATABASE_PACKAGE_DIR, "schema");
const PRISMA_CONFIG_PATH = path.join(DATABASE_PACKAGE_DIR, "prisma.config.ts");
const PRISMA_BIN = path.join(
  REPO_ROOT_DIR,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "prisma.cmd" : "prisma"
);
const MIGRATION_LOCK_CONTENT = 'provider = "postgresql"\n';

export interface PrismaDiffInput {
  environment: NodeJS.ProcessEnv;
  migrationsPath: string;
  prismaBin: string;
  prismaConfigPath: string;
  repoRoot: string;
  schemaPath: string;
}

export type RunPrismaDiff = (input: PrismaDiffInput) => Promise<number>;

export interface MigrationDriftCheckOptions {
  environment?: NodeJS.ProcessEnv;
  migrationsDir: string;
  prismaBin: string;
  prismaConfigPath: string;
  repoRoot: string;
  runPrismaDiff?: RunPrismaDiff;
  schemaPath: string;
}

const isMissingFileError = (error: unknown): boolean =>
  error instanceof Error && "code" in error && error.code === "ENOENT";

export const stagePrismaMigrationHistory = async (
  migrationsDir: string,
  destinationDir: string
): Promise<string[]> => {
  const entries = await fs.readdir(migrationsDir, { withFileTypes: true });
  const schemaMigrationNames: string[] = [];

  for (const entry of entries
    .filter((candidate) => candidate.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))) {
    const sourceSqlPath = path.join(migrationsDir, entry.name, "migration.sql");

    try {
      await fs.access(sourceSqlPath);
    } catch (error: unknown) {
      if (isMissingFileError(error)) {
        continue;
      }

      throw error;
    }

    const destinationMigrationDir = path.join(destinationDir, entry.name);
    await fs.mkdir(destinationMigrationDir, { recursive: true });
    await fs.copyFile(sourceSqlPath, path.join(destinationMigrationDir, "migration.sql"));
    schemaMigrationNames.push(entry.name);
  }

  if (schemaMigrationNames.length === 0) {
    throw new Error(`No schema migrations found in ${migrationsDir}`);
  }

  await fs.writeFile(path.join(destinationDir, "migration_lock.toml"), MIGRATION_LOCK_CONTENT);

  return schemaMigrationNames;
};

export const runPrismaDiff: RunPrismaDiff = async ({
  environment,
  migrationsPath,
  prismaBin,
  prismaConfigPath,
  repoRoot,
  schemaPath,
}) =>
  new Promise<number>((resolve, reject) => {
    const child = spawn(
      prismaBin,
      [
        "migrate",
        "diff",
        "--config",
        prismaConfigPath,
        "--from-migrations",
        migrationsPath,
        "--to-schema",
        schemaPath,
        "--exit-code",
      ],
      {
        cwd: repoRoot,
        env: environment,
        stdio: "inherit",
      }
    );

    child.once("error", reject);
    child.once("close", (exitCode) => {
      resolve(exitCode ?? 1);
    });
  });

export const checkMigrationDrift = async ({
  environment = process.env,
  migrationsDir,
  prismaBin,
  prismaConfigPath,
  repoRoot,
  runPrismaDiff: executePrismaDiff = runPrismaDiff,
  schemaPath,
}: MigrationDriftCheckOptions): Promise<number> => {
  if (!environment.SHADOW_DATABASE_URL?.trim()) {
    throw new Error("SHADOW_DATABASE_URL must point to a dedicated disposable database");
  }

  const temporaryMigrationsDir = await fs.mkdtemp(path.join(os.tmpdir(), "formbricks-prisma-migrations-"));

  try {
    await stagePrismaMigrationHistory(migrationsDir, temporaryMigrationsDir);

    return await executePrismaDiff({
      environment,
      migrationsPath: temporaryMigrationsDir,
      prismaBin,
      prismaConfigPath,
      repoRoot,
      schemaPath,
    });
  } finally {
    await fs.rm(temporaryMigrationsDir, { force: true, recursive: true });
  }
};

const main = async (): Promise<void> => {
  const exitCode = await checkMigrationDrift({
    migrationsDir: MIGRATIONS_DIR,
    prismaBin: PRISMA_BIN,
    prismaConfigPath: PRISMA_CONFIG_PATH,
    repoRoot: REPO_ROOT_DIR,
    schemaPath: SCHEMA_DIR,
  });

  if (exitCode === 2) {
    process.stderr.write("Migration history and Prisma schema have drifted.\n");
  } else if (exitCode !== 0) {
    process.stderr.write(`Prisma migrate diff failed with exit code ${exitCode.toString()}.\n`);
  }

  process.exitCode = exitCode;
};

const entryPoint = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : undefined;

if (entryPoint === import.meta.url) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown migration drift check error";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
