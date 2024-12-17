import { exec } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { promisify } from "node:util";
import { applyMigrations } from "./migration-runner";

const execAsync = promisify(exec);
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function promptForMigrationName(): Promise<string> {
  return new Promise((resolve) => {
    rl.question("Enter the name of the migration (please use spaces): ", (name) => {
      if (!name.trim()) {
        console.error("Migration name cannot be empty.");
        process.exit(1);
      }
      if (/[^a-zA-Z0-9\s]/.test(name)) {
        console.error(
          "Migration name contains invalid characters. Only letters, numbers, and spaces are allowed."
        );
        process.exit(1);
      }
      rl.close();
      resolve(name);
    });
  });
}

async function main(): Promise<void> {
  const migrationName = await promptForMigrationName();
  const migrationNameUnderscored = migrationName.replace(/\s+/g, "_");

  const migrationsDir = path.resolve(__dirname, "../../migrations");
  const customMigrationsDir = path.resolve(__dirname, "../../migration");

  // Check if migration already exists in custom migrations
  const existingMigrations = await fs.readdir(customMigrationsDir);
  const duplicateMigration = existingMigrations.find((dir) => dir.includes(migrationNameUnderscored));

  if (duplicateMigration) {
    throw new Error(`Migration with name "${migrationName}" already exists in ${customMigrationsDir}`);
  }

  // Create migration
  await execAsync(`pnpm prisma migrate dev --name "${migrationName}" --create-only`);
  console.log(`Migration created: ${migrationName}`);

  // Find the newly created migration
  const migrationToCopy = await fs
    .readdir(migrationsDir)
    .then((files) => files.find((dir) => dir.includes(migrationNameUnderscored)));

  if (!migrationToCopy) {
    throw new Error(`migration not found: ${migrationName}`);
  }

  // Check if the migration is empty
  const migrationToCopyPath = path.join(migrationsDir, migrationToCopy);
  const files = await fs.readdir(migrationToCopyPath);

  if (!files.includes("migration.sql")) {
    await fs.rm(migrationToCopyPath, { recursive: true, force: true });
    throw new Error(
      `generated migration directory is empty: ${migrationName}. Please run the migration again.`
    );
  } else {
    const migrationSQL = await fs.readFile(path.join(migrationToCopyPath, "migration.sql"), "utf-8");
    if (migrationSQL === "-- This is an empty migration.") {
      await fs.rm(migrationToCopyPath, { recursive: true, force: true });
      throw new Error(
        "Database schema has not changed. Please make changes to the schema and run the migration again."
      );
    }
  }

  const sourcePath = path.join(migrationsDir, migrationToCopy);
  const destPath = path.join(customMigrationsDir, migrationToCopy);

  // Copy migration folder
  await fs.cp(sourcePath, destPath, { recursive: true });

  // Delete the migration from the original migrations folder
  await fs.rm(sourcePath, { recursive: true, force: true });

  try {
    await applyMigrations();
  } catch (err) {
    console.error("Error applying migrations: ", err);
    // delete the created migration directories:
    await fs.rm(destPath, { recursive: true, force: true });
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error("Migration creation failed:", error);
  process.exit(1);
});
