/* eslint-disable no-console -- logging is allowed in migration scripts */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const TRANSACTION_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds

async function runMigration(): Promise<void> {
  const startTime = Date.now();
  console.log("Starting data migration...");

  await prisma.$transaction(
    async (transactionPrisma) => {
      const websiteSurveys = await transactionPrisma.survey.findMany({
        where: { type: "website" },
      });

      const updationPromises = [];

      for (const websiteSurvey of websiteSurveys) {
        updationPromises.push(
          transactionPrisma.survey.update({
            where: { id: websiteSurvey.id },
            data: {
              type: "app",
              segment: {
                connectOrCreate: {
                  where: {
                    environmentId_title: {
                      environmentId: websiteSurvey.environmentId,
                      title: websiteSurvey.id,
                    },
                  },
                  create: {
                    title: websiteSurvey.id,
                    isPrivate: true,
                    environmentId: websiteSurvey.environmentId,
                  },
                },
              },
            },
          })
        );
      }

      await Promise.all(updationPromises);
      console.log(`Updated ${websiteSurveys.length.toString()} website surveys to app surveys`);
    },
    {
      timeout: TRANSACTION_TIMEOUT,
    }
  );

  const endTime = Date.now();
  console.log(`Data migration completed. Total time: ${((endTime - startTime) / 1000).toFixed(2)}s`);
}

function handleError(error: unknown): void {
  console.error("An error occurred during migration:", error);
  process.exit(1);
}

function handleDisconnectError(): void {
  console.error("Failed to disconnect Prisma client");
  process.exit(1);
}

function main(): void {
  runMigration()
    .catch(handleError)
    .finally(() => {
      prisma.$disconnect().catch(handleDisconnectError);
    });
}

main();
