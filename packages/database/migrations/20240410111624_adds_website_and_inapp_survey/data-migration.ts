import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.$transaction(
    async (tx) => {
      // Move all the previous surveys with type "web" to "inApp" or "website"
      // If a web survey has a response with personId set, then it should be moved to "inApp"
      // otherwise it should be moved to "website"
      const webSurveys = await tx.survey.findMany({
        where: {
          type: "web",
        },
        include: {
          segment: true,
        },
      });

      for (const webSurvey of webSurveys) {
        // get the responses:
        const latestResponse = await tx.response.findFirst({
          where: {
            surveyId: webSurvey.id,
          },
          orderBy: {
            createdAt: "desc",
          },
        });

        if (latestResponse?.personId) {
          await tx.survey.update({
            where: { id: webSurvey.id },
            data: { type: "inApp" },
          });
        } else {
          // This is a website survey, change the type of the survey to "website"

          await tx.survey.update({
            where: { id: webSurvey.id },
            data: {
              type: "website",
            },
          });

          // if the segment with this survey is private, delete it
          if (webSurvey.segment) {
            const { isPrivate, id } = webSurvey.segment;

            if (isPrivate) {
              await tx.segment.delete({
                where: { id },
              });
            } else {
              await tx.survey.update({
                where: { id: webSurvey.id },
                data: {
                  segment: { disconnect: true },
                },
              });
            }
          }

          // find All the segments that are private and have the title as the webSurvey's id
          await tx.segment.deleteMany({
            where: {
              title: webSurvey.id,
              isPrivate: true,
            },
          });
        }
      }
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
