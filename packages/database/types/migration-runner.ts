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
            const existingMigration: { status: "pending" | "applied" | "failed" }[] | undefined = await this
              .prisma.$queryRaw`
              SELECT status FROM "DataMigration"
              WHERE id = ${migration.id}
            `;

            if (existingMigration?.[0]?.status === "pending") {
              console.log(`Data migration ${migration.name} is pending.`);
              console.log(
                "Either there is another migration which is currently running or this is an error."
              );
              console.log(
                "If you are sure that there is no migration running, you need to manually resolve the issue."
              );
              process.exit(1);
              return;
            }

            if (existingMigration?.[0]?.status === "applied") {
              console.log(`Data migration ${migration.name} already completed. Skipping...`);
              return;
            }

            // create a new data migration entry with pending status
            await this.prisma
              .$executeRaw`INSERT INTO "DataMigration" (id, name, status) VALUES (${migration.id}, ${migration.name}, 'pending')`;

            if (migration.run) {
              // Run the actual migration
              await migration.run({
                prisma: this.prisma,
                tx,
              });

              // Mark migration as applied
              await this.prisma.$executeRaw`
                UPDATE "DataMigration"
                SET status = 'applied', finished_at = ${new Date()}
                WHERE id = ${migration.id};
              `;
            }

            console.log(`Data migration ${migration.name} completed successfully`);
            // fake delay:
          },
          { timeout: this.TRANSACTION_TIMEOUT }
        );
      } catch (error) {
        // Record migration failure
        console.error(`Data migration ${migration.name} failed:`, error);
        // Mark migration as failed
        await this.prisma.$queryRaw`
          INSERT INTO "DataMigration" (id, name, status)
          VALUES (${migration.id}, ${migration.name}, 'failed')
        `;
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
