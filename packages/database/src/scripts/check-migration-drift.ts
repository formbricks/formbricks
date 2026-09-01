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
const MIGRATION_LOCK_FILE_NAME = "migration_lock.toml";
const POSTGRESQL_PROTOCOLS = new Set(["postgres:", "postgresql:"]);
const SHADOW_DATABASE_MARKER = "shadow";

export interface CommandInput {
  args: string[];
  command: string;
  cwd: string;
  environment: NodeJS.ProcessEnv;
}

export type ExecuteCommand = (input: CommandInput) => Promise<number>;

export interface PrismaDiffInput {
  environment: NodeJS.ProcessEnv;
  executeCommand?: ExecuteCommand;
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

interface DatabaseIdentity {
  databaseName: string;
  hostname: string;
  port: string;
}

const parseDatabaseIdentity = (databaseUrl: string, variableName: string): DatabaseIdentity => {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    throw new Error(`${variableName} must be a valid PostgreSQL URL`);
  }

  if (!POSTGRESQL_PROTOCOLS.has(parsedUrl.protocol)) {
    throw new Error(`${variableName} must be a valid PostgreSQL URL`);
  }

  const databaseName = decodeURIComponent(parsedUrl.pathname.replace(/^\//, ""));
  if (!parsedUrl.hostname || !databaseName) {
    throw new Error(`${variableName} must be a valid PostgreSQL URL`);
  }

  return {
    databaseName: databaseName.toLowerCase(),
    hostname: parsedUrl.hostname.toLowerCase(),
    port: parsedUrl.port || "5432",
  };
};

export const validateShadowDatabaseEnvironment = (environment: NodeJS.ProcessEnv): void => {
  const databaseUrl = environment.DATABASE_URL?.trim();
  const shadowDatabaseUrl = environment.SHADOW_DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error("DATABASE_URL must be set so shadow database isolation can be verified");
  }

  if (!shadowDatabaseUrl) {
    throw new Error("SHADOW_DATABASE_URL must point to a dedicated disposable database");
  }

  const databaseIdentity = parseDatabaseIdentity(databaseUrl, "DATABASE_URL");
  const shadowDatabaseIdentity = parseDatabaseIdentity(shadowDatabaseUrl, "SHADOW_DATABASE_URL");

  if (!shadowDatabaseIdentity.databaseName.includes(SHADOW_DATABASE_MARKER)) {
    throw new Error('SHADOW_DATABASE_URL database name must contain the marker "shadow"');
  }

  if (
    databaseIdentity.hostname === shadowDatabaseIdentity.hostname &&
    databaseIdentity.port === shadowDatabaseIdentity.port &&
    databaseIdentity.databaseName === shadowDatabaseIdentity.databaseName
  ) {
    throw new Error("SHADOW_DATABASE_URL must not target the DATABASE_URL database");
  }
};

export const sortMigrationDirectoryNames = (migrationNames: string[]): string[] =>
  [...migrationNames].sort((a, b) => a.localeCompare(b));

export const stagePrismaMigrationHistory = async (
  migrationsDir: string,
  destinationDir: string
): Promise<string[]> => {
  const entries = await fs.readdir(migrationsDir, { withFileTypes: true });
  const schemaMigrationNames: string[] = [];

  const migrationDirectoryNames = sortMigrationDirectoryNames(
    entries.filter((candidate) => candidate.isDirectory()).map((entry) => entry.name)
  );

  for (const migrationName of migrationDirectoryNames) {
    const sourceSqlPath = path.join(migrationsDir, migrationName, "migration.sql");

    try {
      await fs.access(sourceSqlPath);
    } catch (error: unknown) {
      if (isMissingFileError(error)) {
        continue;
      }

      throw error;
    }

    const destinationMigrationDir = path.join(destinationDir, migrationName);
    await fs.mkdir(destinationMigrationDir, { recursive: true });
    await fs.copyFile(sourceSqlPath, path.join(destinationMigrationDir, "migration.sql"));
    schemaMigrationNames.push(migrationName);
  }

  if (schemaMigrationNames.length === 0) {
    throw new Error(`No schema migrations found in ${migrationsDir}`);
  }

  await fs.copyFile(
    path.join(migrationsDir, MIGRATION_LOCK_FILE_NAME),
    path.join(destinationDir, MIGRATION_LOCK_FILE_NAME)
  );

  return schemaMigrationNames;
};

const spawnCommand: ExecuteCommand = async ({ args, command, cwd, environment }) =>
  new Promise<number>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: environment,
      stdio: "inherit",
    });

    child.once("error", reject);
    child.once("close", (exitCode) => {
      resolve(exitCode ?? 1);
    });
  });

export const runPrismaDiff: RunPrismaDiff = async ({
  environment,
  executeCommand = spawnCommand,
  migrationsPath,
  prismaBin,
  prismaConfigPath,
  repoRoot,
  schemaPath,
}) =>
  executeCommand({
    args: [
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
    command: prismaBin,
    cwd: repoRoot,
    environment,
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
  validateShadowDatabaseEnvironment(environment);

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
