import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

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

  execSync(`pnpm prisma migrate dev --name "${migrationName}" --create-only`, { stdio: "inherit" });
  console.log(`Migration created: ${migrationName}`);

  const migrationsDir = path.resolve(__dirname, "../migrations");
  const tempMigrationsDir = path.resolve(__dirname, "../temp-migrations");

  // Ensure temp migrations directory exists
  if (!fs.existsSync(tempMigrationsDir)) {
    fs.mkdirSync(tempMigrationsDir, { recursive: true });
  }

  const migrationNameUnderscored = migrationName.replace(/\s+/g, "_");

  const migrationToCopy = fs.readdirSync(migrationsDir).find((dir) => dir.includes(migrationNameUnderscored));

  if (!migrationToCopy) {
    console.error(`Migration not found: ${migrationName}`);
    return;
  }

  const sourcePath = path.join(migrationsDir, migrationToCopy);
  const destPath = path.join(tempMigrationsDir, migrationToCopy);

  // Copy migration folder
  fs.cpSync(sourcePath, destPath, { recursive: true });

  // Delete the migration from the original migrations folder
  fs.rmSync(sourcePath, { recursive: true, force: true });
}

main().catch((error: unknown) => {
  console.error("Migration creation failed:", error);
  process.exit(1);
});
