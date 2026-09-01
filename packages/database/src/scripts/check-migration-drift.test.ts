import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  checkMigrationDrift,
  runPrismaDiff,
  sortMigrationDirectoryNames,
  stagePrismaMigrationHistory,
  validateShadowDatabaseEnvironment,
} from "./check-migration-drift";

const temporaryPaths: string[] = [];
const MIGRATION_LOCK_CONTENT = '# Migration lock fixture\nprovider = "postgresql"\n';

const createTemporaryDirectory = async (prefix: string): Promise<string> => {
  const temporaryPath = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  temporaryPaths.push(temporaryPath);
  return temporaryPath;
};

const createMigration = async (
  migrationsDir: string,
  migrationName: string,
  fileName: "migration.sql" | "migration.ts"
): Promise<void> => {
  const migrationDir = path.join(migrationsDir, migrationName);
  await fs.mkdir(migrationDir, { recursive: true });
  await fs.writeFile(
    path.join(migrationDir, fileName),
    fileName === "migration.sql" ? "SELECT 1;\n" : "export {};\n"
  );
};

const createMigrationHistory = async (): Promise<string> => {
  const migrationsDir = await createTemporaryDirectory("formbricks-migration-source-");
  await fs.writeFile(path.join(migrationsDir, "migration_lock.toml"), MIGRATION_LOCK_CONTENT);
  return migrationsDir;
};

afterEach(async () => {
  await Promise.all(
    temporaryPaths.splice(0).map((temporaryPath) => fs.rm(temporaryPath, { force: true, recursive: true }))
  );
});

describe("stagePrismaMigrationHistory", () => {
  test("sorts migration directory names chronologically", () => {
    expect(sortMigrationDirectoryNames(["20260103000000_third", "20260101000000_first"])).toEqual([
      "20260101000000_first",
      "20260103000000_third",
    ]);
  });

  test("copies schema migrations in order and ignores data migrations", async () => {
    const migrationsDir = await createMigrationHistory();
    const destinationDir = await createTemporaryDirectory("formbricks-migration-destination-");

    await createMigration(migrationsDir, "20260103000000_second_schema", "migration.sql");
    await createMigration(migrationsDir, "20260102000000_data_only", "migration.ts");
    await createMigration(migrationsDir, "20260101000000_first_schema", "migration.sql");

    const stagedMigrations = await stagePrismaMigrationHistory(migrationsDir, destinationDir);

    expect(stagedMigrations).toEqual(["20260101000000_first_schema", "20260103000000_second_schema"]);
    expect(await fs.readFile(path.join(destinationDir, "migration_lock.toml"), "utf8")).toBe(
      MIGRATION_LOCK_CONTENT
    );
    expect((await fs.readdir(destinationDir)).sort()).toEqual([
      "20260101000000_first_schema",
      "20260103000000_second_schema",
      "migration_lock.toml",
    ]);
  });
});

describe("runPrismaDiff", () => {
  test("invokes Prisma migrate diff with exit-code enabled", async () => {
    const environment = { SHADOW_DATABASE_URL: "postgresql://postgres:postgres@localhost/shadow" };
    const executeCommand = vi.fn(() => Promise.resolve(2));

    await expect(
      runPrismaDiff({
        environment,
        executeCommand,
        migrationsPath: "/tmp/migrations",
        prismaBin: "/repo/node_modules/.bin/prisma",
        prismaConfigPath: "/repo/packages/database/prisma.config.ts",
        repoRoot: "/repo",
        schemaPath: "/repo/packages/database/schema",
      })
    ).resolves.toBe(2);

    expect(executeCommand).toHaveBeenCalledWith({
      args: [
        "migrate",
        "diff",
        "--config",
        "/repo/packages/database/prisma.config.ts",
        "--from-migrations",
        "/tmp/migrations",
        "--to-schema",
        "/repo/packages/database/schema",
        "--exit-code",
      ],
      command: "/repo/node_modules/.bin/prisma",
      cwd: "/repo",
      environment,
    });
  });
});

describe("checkMigrationDrift", () => {
  const databaseEnvironment = {
    DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/formbricks",
    SHADOW_DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/formbricks_shadow",
  };

  test("accepts distinct primary and explicitly marked shadow databases", () => {
    expect(() => validateShadowDatabaseEnvironment(databaseEnvironment)).not.toThrow();
  });

  test.each([
    {
      environment: { SHADOW_DATABASE_URL: databaseEnvironment.SHADOW_DATABASE_URL },
      expectedError: "DATABASE_URL must be set so shadow database isolation can be verified",
      name: "a missing primary URL",
    },
    {
      environment: { DATABASE_URL: databaseEnvironment.DATABASE_URL },
      expectedError: "SHADOW_DATABASE_URL must point to a dedicated disposable database",
      name: "a missing shadow URL",
    },
    {
      environment: {
        DATABASE_URL: databaseEnvironment.DATABASE_URL,
        SHADOW_DATABASE_URL: " ",
      },
      expectedError: "SHADOW_DATABASE_URL must point to a dedicated disposable database",
      name: "a blank shadow URL",
    },
    {
      environment: {
        DATABASE_URL: databaseEnvironment.DATABASE_URL,
        SHADOW_DATABASE_URL: "not-a-url",
      },
      expectedError: "SHADOW_DATABASE_URL must be a valid PostgreSQL URL",
      name: "an invalid shadow URL",
    },
    {
      environment: {
        DATABASE_URL: databaseEnvironment.DATABASE_URL,
        SHADOW_DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/formbricks_scratch",
      },
      expectedError: 'SHADOW_DATABASE_URL database name must contain the marker "shadow"',
      name: "an unmarked shadow database",
    },
    {
      environment: {
        DATABASE_URL: "postgresql://postgres:postgres@localhost/formbricks_shadow?schema=main",
        SHADOW_DATABASE_URL: "postgres://postgres:postgres@localhost:5432/formbricks_shadow?schema=public",
      },
      expectedError: "SHADOW_DATABASE_URL must not target the DATABASE_URL database",
      name: "the primary database through an equivalent URL",
    },
  ])("rejects $name", ({ environment, expectedError }) => {
    expect(() => validateShadowDatabaseEnvironment(environment)).toThrow(expectedError);
  });

  test.each([1, 2])("propagates Prisma exit code %i and removes the staged history", async (exitCode) => {
    const migrationsDir = await createMigrationHistory();
    await createMigration(migrationsDir, "20260101000000_schema", "migration.sql");
    let stagedMigrationsPath = "";
    const executePrismaDiff = vi.fn(async ({ migrationsPath }: { migrationsPath: string }) => {
      stagedMigrationsPath = migrationsPath;
      expect(await fs.readFile(path.join(migrationsPath, "migration_lock.toml"), "utf8")).toBe(
        MIGRATION_LOCK_CONTENT
      );
      return exitCode;
    });

    await expect(
      checkMigrationDrift({
        environment: databaseEnvironment,
        migrationsDir,
        prismaBin: "prisma",
        prismaConfigPath: "prisma.config.ts",
        repoRoot: "/repo",
        runPrismaDiff: executePrismaDiff,
        schemaPath: "schema",
      })
    ).resolves.toBe(exitCode);

    await expect(fs.access(stagedMigrationsPath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("propagates process errors and still removes the staged history", async () => {
    const migrationsDir = await createMigrationHistory();
    await createMigration(migrationsDir, "20260101000000_schema", "migration.sql");
    let stagedMigrationsPath = "";
    const executePrismaDiff = vi.fn(({ migrationsPath }: { migrationsPath: string }) => {
      stagedMigrationsPath = migrationsPath;
      return Promise.reject(new Error("Prisma process failed to start"));
    });

    await expect(
      checkMigrationDrift({
        environment: databaseEnvironment,
        migrationsDir,
        prismaBin: "prisma",
        prismaConfigPath: "prisma.config.ts",
        repoRoot: "/repo",
        runPrismaDiff: executePrismaDiff,
        schemaPath: "schema",
      })
    ).rejects.toThrow("Prisma process failed to start");

    await expect(fs.access(stagedMigrationsPath)).rejects.toMatchObject({ code: "ENOENT" });
  });
});
