import type { Prisma, PrismaClient } from "@prisma/client";

export interface DataMigrationContext {
  prisma: PrismaClient;
  tx: Omit<
    PrismaClient<Prisma.PrismaClientOptions, never>,
    "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
  >;
}

export interface DataMigrationScript {
  id: string;
  name: string;
  run: (context: DataMigrationContext) => Promise<void>;
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

          console.log(`Data migration ${migration.name} completed successfully`);
        },
        { timeout: this.TRANSACTION_TIMEOUT }
      );
    } catch (error) {
      // Record migration failure
      console.error(`Data migration ${migration.name} failed:`, error);
      throw error;
    }
  }
}
