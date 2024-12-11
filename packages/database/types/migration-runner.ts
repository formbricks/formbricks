import { exec } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import type { Prisma, PrismaClient } from "@prisma/client";

const execAsync = promisify(exec);

export interface DataMigrationContext {
  prisma: PrismaClient;
  tx: Omit<
    PrismaClient<Prisma.PrismaClientOptions, never>,
    "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
  >;
}

export interface DataMigrationScript {
  id?: string;
  name: string;
  run?: (context: DataMigrationContext) => Promise<void>;
  type: "data" | "schema";
}

export class MigrationRunner {
  private prisma: PrismaClient;
  private TRANSACTION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async runMigrations(dataMigrations: DataMigrationScript[]): Promise<void> {
    console.log(`Starting data migrations: ${dataMigrations.length.toString()} to run`);
    const startTime = Date.now();

    for (const dataMigration of dataMigrations) {
      await this.runSingleMigration(dataMigration);
    }

    const endTime = Date.now();
    console.log(`All data migrations completed in ${((endTime - startTime) / 1000).toFixed(2)}s`);
  }

  private async runSingleMigration(migration: DataMigrationScript): Promise<void> {
    if (migration.type === "data") {
      console.log(`Running data migration: ${migration.name}`);

      try {
        await this.prisma.$transaction(
          async (tx) => {
            // Check if migration has already been run
            const existingMigration = await tx.dataMigration.findUnique({
              where: { id: migration.id },
            });

            if (existingMigration?.applied) {
              console.log(`Data migration ${migration.name} already completed. Skipping...`);
              return;
            }

            const startTime = new Date();

            if (migration.run) {
              // Run the actual migration
              await migration.run({
                prisma: this.prisma,
                tx,
              });

              // Mark migration as applied
              await tx.dataMigration.upsert({
                where: { id: migration.id },
                update: {
                  applied: true,
                  finishedAt: new Date(),
                  startedAt: startTime,
                },
                create: {
                  id: migration.id,
                  name: migration.name,
                  applied: true,
                  startedAt: startTime,
                  finishedAt: new Date(),
                },
              });
            }

            console.log(`Data migration ${migration.name} completed successfully`);
          },
          { timeout: this.TRANSACTION_TIMEOUT }
        );
      } catch (error) {
        // Record migration failure
        console.error(`Data migration ${migration.name} failed:`, error);
        throw error;
      }
    } else {
      console.log(`Running schema migration: ${migration.name}`);

      // Original Prisma migrations directory
      const originalMigrationsDir = path.resolve(__dirname, "../migrations");
      // Temporary migrations directory for controlled migration
      const tempMigrationsDir = path.resolve(__dirname, "../migration");

      // Ensure prisma migrations directory exists
      if (!fs.existsSync(originalMigrationsDir)) {
        fs.mkdirSync(originalMigrationsDir, { recursive: true });
      }

      // Copy specific schema migration from temp migrations directory to original migrations directory
      const migrationToCopy = fs.readdirSync(tempMigrationsDir).find((dir) => dir.includes(migration.name));

      if (!migrationToCopy) {
        console.error(`Schema migration not found: ${migration.name}`);
        return;
      }

      const sourcePath = path.join(tempMigrationsDir, migrationToCopy);
      const destPath = path.join(originalMigrationsDir, migrationToCopy);

      // Copy migration folder
      fs.cpSync(sourcePath, destPath, { recursive: true });

      // Run Prisma migrate
      // throws
      await execAsync("pnpm prisma migrate deploy");
      console.log(`Successfully applied schema migration: ${migration.name}`);
    }
  }
}

// async function isSchemaMigrationApplied(migrationName: string, prisma: PrismaClient): Promise<boolean> {
//   const applied: unknown[] = await prisma.$queryRaw`
//     SELECT 1
//     FROM _prisma_migrations
//     WHERE migration_name = ${migrationName}
//       AND finished_at IS NOT NULL
//     LIMIT 1;
//   `;
//   return applied.length > 0;
// }
