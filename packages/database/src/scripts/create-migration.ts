import { exec } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { promisify } from "node:util";

const execAsync = promisify(exec);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function promptForMigrationName(): Promise<string> {
  return new Promise((resolve) => {
    rl.question("Enter the name of the migration (please use spaces): ", (name) => {
      rl.close();
      resolve(name);
    });
  });
}

// ask the user for the migration name and run `pnpm prisma migrate dev --name <migration-name> --create-only` to create the migration
// then copy the migration script from the prisma migrations folder to a temp folder

async function main(): Promise<void> {
  const migrationName = await promptForMigrationName();

  await execAsync(`pnpm prisma migrate dev --name "${migrationName}" --create-only`);
  console.log(`Migration created: ${migrationName}`);

  const migrationsDir = path.resolve(__dirname, "../../migrations");
  const customMigrationsDir = path.resolve(__dirname, "../../migration");

  // Ensure custom migrations directory exists
  if (!fs.existsSync(customMigrationsDir)) {
    fs.mkdirSync(customMigrationsDir, { recursive: true });
  }

  const migrationNameUnderscored = migrationName.replace(/\s+/g, "_");
  const migrationToCopy = fs.readdirSync(migrationsDir).find((dir) => dir.includes(migrationNameUnderscored));

  if (!migrationToCopy) {
    throw new Error(`migration not found: ${migrationName}`);
  }

  // check if the migrationToCopy is empty:
  const migrationToCopyPath = path.join(migrationsDir, migrationToCopy);
  const files = fs.readdirSync(migrationToCopyPath);
  if (!files.includes("migration.sql")) {
    fs.rmSync(migrationToCopyPath, { recursive: true, force: true });
    throw new Error(
      `generated migration directory is empty: ${migrationName}. Please run the migration again.`
    );
  } else {
    const migrationSQL = fs.readFileSync(path.join(migrationToCopyPath, "migration.sql"), "utf-8");

    if (migrationSQL === "-- This is an empty migration.") {
      fs.rmSync(migrationToCopyPath, { recursive: true, force: true });
      throw new Error(
        "Database schema has not changed. Please make changes to the schema and run the migration again."
      );
    }
  }

  const sourcePath = path.join(migrationsDir, migrationToCopy);
  const destPath = path.join(customMigrationsDir, migrationToCopy);

  // Copy migration folder
  fs.cpSync(sourcePath, destPath, { recursive: true });

  // Delete the migration from the original migrations folder
  fs.rmSync(sourcePath, { recursive: true, force: true });
}

main().catch((error: unknown) => {
  console.error("Migration creation failed:", error);
  process.exit(1);
});
