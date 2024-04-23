import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.$transaction(
    async (tx) => {
      // Retrieve all surveys of type "web" with necessary fields for efficient processing
      const webSurveys = await tx.survey.findMany({
        where: { type: "web" },
        select: {
          id: true,
          segment: {
            select: {
              id: true,
              isPrivate: true,
            },
          },
        },
      });

      const updateOperations = [];
      const segmentDeletionIds = [];
      const surveyTitlesForDeletion = [];

      for (const webSurvey of webSurveys) {
        const latestResponse = await tx.response.findFirst({
          where: { surveyId: webSurvey.id },
          orderBy: { createdAt: "desc" },
          select: { personId: true },
        });

        const newType = latestResponse?.personId ? "app" : "website";
        updateOperations.push(
          tx.survey.update({
            where: { id: webSurvey.id },
            data: { type: newType },
          })
        );

        if (newType === "website") {
          if (webSurvey.segment) {
            if (webSurvey.segment.isPrivate) {
              segmentDeletionIds.push(webSurvey.segment.id);
            } else {
              updateOperations.push(
                tx.survey.update({
                  where: { id: webSurvey.id },
                  data: {
                    segment: { disconnect: true },
                  },
                })
              );
            }
          }

          surveyTitlesForDeletion.push(webSurvey.id);
        }
      }

      await Promise.all(updateOperations);

      if (segmentDeletionIds.length > 0) {
        await tx.segment.deleteMany({
          where: {
            id: { in: segmentDeletionIds },
          },
        });
      }

      if (surveyTitlesForDeletion.length > 0) {
        await tx.segment.deleteMany({
          where: {
            title: { in: surveyTitlesForDeletion },
            isPrivate: true,
          },
        });
      }
    },
    {
      timeout: 50000,
    }
  );
}

main()
  .catch((e: Error) => {
    console.error("Error during migration: ", e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
1;
