import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { createId } from "@paralleldrive/cuid2";
import { logger } from "@formbricks/logger";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const migrationsDir = path.resolve(__dirname, "../../migration");

async function createMigration(): Promise<void> {
  // Log the full path to verify directory location
  logger.info(migrationsDir, "Migrations Directory Full Path");

  // Check if migrations directory exists, create if not
  const hasAccess = await fs
    .access(migrationsDir)
    .then(() => true)
    .catch(() => false);

  if (!hasAccess) {
    await fs.mkdir(migrationsDir, { recursive: true });
    logger.info(`Created migrations directory: ${migrationsDir}`);
  }

  const migrationNameSpaced = await promptForMigrationName();
  const migrationName = migrationNameSpaced.replace(/\s+/g, "_");
  const migrationFunctionName = migrationNameSpaced
    .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => (index === 0 ? word.toLowerCase() : word.toUpperCase()))
    .replace(/\s+/g, "");

  const existingMigrations = await fs.readdir(migrationsDir);
  const duplicateMigration = existingMigrations.find((dir) => dir.includes(migrationName));

  if (duplicateMigration) {
    throw new Error(`Migration with name "${migrationName}" already exists in ${migrationsDir}`);
  }

  const timestamp = generateTimestamp();
  const migrationNameTimestamped = `${timestamp}_${migrationName}`;
  const fullMigrationPath = path.join(migrationsDir, migrationNameTimestamped);
  const filePath = path.join(fullMigrationPath, "migration.ts");

  const hasAccessToMigration = await fs
    .access(fullMigrationPath)
    .then(() => true)
    .catch(() => false);

  // Check if the migration already exists
  if (hasAccessToMigration) {
    throw new Error(`Migration "${migrationName}" already exists.`);
  }

  // Create the migration directory
  await fs.mkdir(fullMigrationPath, { recursive: true });
  logger.info(fullMigrationPath, "Created migration directory");

  // Create the migration file
  await fs.writeFile(filePath, getTemplateContent(migrationFunctionName, migrationNameTimestamped));
  logger.info(filePath, "New migration created");
}

function promptForMigrationName(): Promise<string> {
  return new Promise((resolve) => {
    rl.question("Enter the name of the migration (please use spaces): ", (name) => {
      if (!name.trim()) {
        logger.error("Migration name cannot be empty.");
        process.exit(1);
      }
      if (/[^a-zA-Z0-9\s]/.test(name)) {
        logger.error(
          "Migration name contains invalid characters. Only letters, numbers, and spaces are allowed."
        );
        process.exit(1);
      }
      rl.close();
      resolve(name);
    });
  });
}

function generateTimestamp(): string {
  const now = new Date();
  // use UTC time to avoid timezone issues

  const utcTime = now.toISOString().replace(/[-:]/g, "").replace("T", "").replace("Z", "").slice(0, 14);
  return utcTime;
}

function getTemplateContent(migrationName: string, fullMigrationName: string): string {
  const migrationId = createId();

  return `
import type { MigrationScript } from "../../src/scripts/migration-runner";

export const ${migrationName}: MigrationScript = {
  type: "data",
  id: "${migrationId}",
  name: "${fullMigrationName}",
  run: async ({ tx }) => {
    // Your migration script goes here
  }
};
`;
}

createMigration().catch((error: unknown) => {
  logger.fatal(error, "An error occurred while creating the migration");
  process.exit(1);
});
