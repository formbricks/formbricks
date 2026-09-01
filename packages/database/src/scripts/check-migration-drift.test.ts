import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { checkMigrationDrift, stagePrismaMigrationHistory } from "./check-migration-drift";

const temporaryPaths: string[] = [];

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

afterEach(async () => {
  await Promise.all(
    temporaryPaths.splice(0).map((temporaryPath) => fs.rm(temporaryPath, { force: true, recursive: true }))
  );
});

describe("stagePrismaMigrationHistory", () => {
  test("copies schema migrations in order and ignores data migrations", async () => {
    const migrationsDir = await createTemporaryDirectory("formbricks-migration-source-");
    const destinationDir = await createTemporaryDirectory("formbricks-migration-destination-");

    await createMigration(migrationsDir, "20260103000000_second_schema", "migration.sql");
    await createMigration(migrationsDir, "20260102000000_data_only", "migration.ts");
    await createMigration(migrationsDir, "20260101000000_first_schema", "migration.sql");

    const stagedMigrations = await stagePrismaMigrationHistory(migrationsDir, destinationDir);

    expect(stagedMigrations).toEqual(["20260101000000_first_schema", "20260103000000_second_schema"]);
    expect(await fs.readFile(path.join(destinationDir, "migration_lock.toml"), "utf8")).toBe(
      'provider = "postgresql"\n'
    );
    expect((await fs.readdir(destinationDir)).sort()).toEqual([
      "20260101000000_first_schema",
      "20260103000000_second_schema",
      "migration_lock.toml",
    ]);
  });
});

describe("checkMigrationDrift", () => {
  test.each([1, 2])("propagates Prisma exit code %i and removes the staged history", async (exitCode) => {
    const migrationsDir = await createTemporaryDirectory("formbricks-migration-source-");
    await createMigration(migrationsDir, "20260101000000_schema", "migration.sql");
    let stagedMigrationsPath = "";
    const executePrismaDiff = vi.fn(async ({ migrationsPath }: { migrationsPath: string }) => {
      stagedMigrationsPath = migrationsPath;
      expect(await fs.readFile(path.join(migrationsPath, "migration_lock.toml"), "utf8")).toBe(
        'provider = "postgresql"\n'
      );
      return exitCode;
    });

    await expect(
      checkMigrationDrift({
        environment: { SHADOW_DATABASE_URL: "postgresql://postgres:postgres@localhost/shadow" },
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
    const migrationsDir = await createTemporaryDirectory("formbricks-migration-source-");
    await createMigration(migrationsDir, "20260101000000_schema", "migration.sql");
    let stagedMigrationsPath = "";
    const executePrismaDiff = vi.fn(({ migrationsPath }: { migrationsPath: string }) => {
      stagedMigrationsPath = migrationsPath;
      return Promise.reject(new Error("Prisma process failed to start"));
    });

    await expect(
      checkMigrationDrift({
        environment: { SHADOW_DATABASE_URL: "postgresql://postgres:postgres@localhost/shadow" },
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
