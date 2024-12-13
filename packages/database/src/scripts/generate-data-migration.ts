import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { createId } from "@paralleldrive/cuid2";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const migrationsDir = path.resolve(__dirname, "../../migration");

async function createMigration(): Promise<void> {
  try {
    // Log the full path to verify directory location
    console.log("Migrations Directory Full Path:", migrationsDir);

    // Check if migrations directory exists, create if not
    if (!fs.existsSync(migrationsDir)) {
      fs.mkdirSync(migrationsDir, { recursive: true });
      console.log(`Created migrations directory: ${migrationsDir}`);
    }

    const migrationNameSpaced = await promptForMigrationName();
    const migrationName = migrationNameSpaced.replace(/\s+/g, "_");
    const migrationFunctionName = migrationNameSpaced
      .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
        index === 0 ? word.toLowerCase() : word.toUpperCase()
      )
      .replace(/\s+/g, "");

    const timestamp = generateTimestamp();
    const migrationNameTimestamped = `${timestamp}_${migrationName}`;
    const fullMigrationPath = path.join(migrationsDir, migrationNameTimestamped);
    const filePath = path.join(fullMigrationPath, "migration.ts");

    // Check if the migration already exists
    if (fs.existsSync(fullMigrationPath)) {
      console.error(`Migration "${migrationName}" already exists.`);
      return;
    }

    // Create the migration directory
    fs.mkdirSync(fullMigrationPath, { recursive: true });
    console.log("Created migration directory:", fullMigrationPath);

    // Create the migration file
    fs.writeFileSync(filePath, getTemplateContent(migrationFunctionName, migrationNameTimestamped));
    console.log(`New migration created: ${filePath}`);
  } catch (error) {
    console.error("Detailed Error:", error);
    if (error instanceof Error) {
      console.error("Error Message:", error.message);
      console.error("Error Stack:", error.stack);
    }
  }
}

function promptForMigrationName(): Promise<string> {
  return new Promise((resolve) => {
    rl.question("Enter the name of the migration (please use spaces): ", (name) => {
      rl.close();
      resolve(name);
    });
  });
}

function generateTimestamp(): string {
  const now = new Date();
  return `${now.getFullYear().toString()}${padZero(now.getMonth() + 1)}${padZero(now.getDate())}${padZero(now.getHours())}${padZero(now.getMinutes())}${padZero(now.getSeconds())}`;
}

function padZero(value: number): string {
  return value.toString().padStart(2, "0");
}

function getTemplateContent(migrationName: string, fullMigrationName: string): string {
  const migrationId = createId();

  return `
import type { DataMigrationScript } from "../../src/scripts/migration-runner";

export const ${migrationName}: DataMigrationScript = {
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
  console.error("An error occurred while creating the migration:", error);
  process.exit(1);
});
