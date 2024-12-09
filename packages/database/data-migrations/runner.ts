 

 

 

 
import type { PrismaClient } from "@prisma/client";
import type { DataMigrationScript } from "../types/migration-runner";

export class MigrationRunner {
  private prisma: PrismaClient;
  private TRANSACTION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async runMigrations(migrations: DataMigrationScript[]): Promise<void> {
    console.log(`Starting migrations: ${migrations.length.toString()} to run`);
    const startTime = Date.now();

    for (const migration of migrations) {
      await this.runSingleMigration(migration);
    }

    const endTime = Date.now();
    console.log(`All migrations completed in ${((endTime - startTime) / 1000).toFixed(2)}s`);
  }

  private async runSingleMigration(migration: DataMigrationScript): Promise<void> {
    console.log(`Running migration: ${migration.name}`);

    try {
      await this.prisma.$transaction(
        async (tx) => {
          // Check if migration has already been run
          const existingMigration = await tx.dataMigration.findUnique({
            where: { id: migration.id },
          });

          if (existingMigration?.applied) {
            console.log(`Migration ${migration.name} already completed. Skipping.`);
            return;
          }

          const startTime = new Date();

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

          console.log(`Migration ${migration.name} completed successfully`);
        },
        { timeout: this.TRANSACTION_TIMEOUT }
      );
    } catch (error) {
      // Record migration failure
      console.error(`Migration ${migration.name} failed:`, error);
      throw error;
    }
  }
}
