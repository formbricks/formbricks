import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.$transaction(
    async (tx) => {
      // Move all the previous surveys with type "web" to "app" or "website"
      // If a web survey has a response with personId set, then it should be moved to "app"
      // otherwise it should be moved to "website"
      const webSurveys = await tx.survey.findMany({
        where: {
          type: "web",
        },
        include: {
          segment: true,
        },
      });

      const operations = [];

      for (const webSurvey of webSurveys) {
        // get the latest response
        const latestResponse = await tx.response.findFirst({
          where: {
            surveyId: webSurvey.id,
          },
          orderBy: {
            createdAt: "desc",
          },
        });

        const newType = latestResponse?.personId ? "app" : "website";

        // Safely update survey type
        operations.push(
          tx.survey.update({
            where: { id: webSurvey.id },
            data: { type: newType },
          })
        );

        if (newType === "website" && webSurvey.segment) {
          if (webSurvey.segment.isPrivate) {
            // Safely delete private segments
            operations.push(
              tx.segment.delete({
                where: { id: webSurvey.segment.id },
              })
            );
          } else {
            // Disconnect segment from survey if not private
            operations.push(
              tx.survey.update({
                where: { id: webSurvey.id },
                data: {
                  segment: { disconnect: true },
                },
              })
            );
          }

          // Conditionally delete segments based on their title and privacy
          operations.push(
            tx.segment.deleteMany({
              where: {
                title: webSurvey.id,
                isPrivate: true,
              },
            })
          );
        }
      }

      // Execute all operations in parallel for efficiency
      await Promise.all(operations);
    },
    {
      timeout: 50000,
    }
  );
}
main()
  .catch(async (e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => await prisma.$disconnect());
