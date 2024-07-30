// migration script for replacing verifyEmail with isVerifyEmailEnabled
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const main = async () => {
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
          },
        });
      });

      await Promise.all(updatePromises);
      console.log(transformedSurveyCount, " surveys transformed");
      const endTime = Date.now();
      console.log(`Data migration completed. Total time: ${(endTime - startTime) / 1000}s`);
    },
    {
      timeout: 180000, // 3 minutes
    }
  );
};

main()
  .catch((e: Error) => {
    console.error("Error during migration: ", e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
