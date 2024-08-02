/* eslint-disable no-console -- logging is allowed in migration scripts */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function runMigration(): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      const startTime = Date.now();
      console.log("Starting data migration...");

      // Fetch all surveys
      const surveys = await tx.survey.findMany({
        select: {
          id: true,
          verifyEmail: true,
        },
      });

      if (surveys.length === 0) {
        // stop the migration if there are no surveys
        console.log("No Surveys found");
        return;
      }

      let transformedSurveyCount = 0;

      const surveysWithEmailVerificationEnabled = surveys.filter(
        (survey) => survey.verifyEmail !== null && survey.verifyEmail !== undefined
      );

      const updatePromises = surveysWithEmailVerificationEnabled.map((survey) => {
        transformedSurveyCount++;
        // Return the update promise
        return tx.survey.update({
          where: { id: survey.id },
          data: {
            isVerifyEmailEnabled: true,
            verifyEmail: null,
          },
        });
      });

      await Promise.all(updatePromises);
      console.log(transformedSurveyCount, " surveys transformed");
      const endTime = Date.now();
      console.log(`Data migration completed. Total time: ${((endTime - startTime) / 1000).toString()}s`);
    },
    {
      timeout: 180000, // 3 minutes
    }
  );
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
