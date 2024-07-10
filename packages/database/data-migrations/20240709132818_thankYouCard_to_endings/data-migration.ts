// migration script for converting thankYouCard to survey endings
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
          thankYouCard: true,
          redirectUrl: true,
        },
      });

      if (surveys.length === 0) {
        // Stop the migration if there are no surveys
        console.log("No Surveys found");
        return;
      }

      console.log(`Total surveys found: ${surveys.length}`);
      let transformedSurveyCount = 0;

      const updatePromises = surveys.map((survey) => {
        transformedSurveyCount++;
        const updatedSurvey = structuredClone(survey);

        if (survey.redirectUrl) {
          // @ts-expect-error
          updatedSurvey.endings = [
            {
              enabled: true,
              type: "redirectToUrl",
              label: "Redirect Url",
              id: "end:1",
              url: survey.redirectUrl,
            },
          ];
        } else {
          // @ts-expect-error
          updatedSurvey.endings = [
            { ...survey.thankYouCard, type: "endScreen", enabled: survey.thankYouCard.enabled, id: "end:1" },
          ];
        }

        // Return the update promise
        return tx.survey.update({
          where: { id: survey.id },
          data: {
            // @ts-expect-error
            endings: updatedSurvey.endings,
            thankYouCard: undefined,
            redirectUrl: undefined,
          },
        });
      });

      await Promise.all(updatePromises);

      console.log(`${transformedSurveyCount} surveys transformed`);
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
