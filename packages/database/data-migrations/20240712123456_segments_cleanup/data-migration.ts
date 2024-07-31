import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.$transaction(
    async (tx) => {
      console.log("starting migration");
      const segmentsWithNoSurveys = await tx.segment.findMany({
        where: {
          surveys: {
            none: {},
          },
        },
      });

      const surveyIds = segmentsWithNoSurveys.map((segment) => segment.id);

      await tx.segment.deleteMany({
        where: {
          id: {
            in: surveyIds,
          },
        },
      });

      console.log(`Deleted ${segmentsWithNoSurveys.length} segments with no surveys`);

      const appSurveysWithoutSegment = await tx.survey.findMany({
        where: {
          type: "app",
          segmentId: null,
        },
      });

      console.log(`Found ${appSurveysWithoutSegment.length} app surveys without a segment`);

      const segmentPromises = [];

      for (const appSurvey of appSurveysWithoutSegment) {
        // create a new private segment for each app survey

        segmentPromises.push(
          tx.segment.create({
            data: {
              title: appSurvey.id,
              isPrivate: true,
              environment: { connect: { id: appSurvey.environmentId } },
              surveys: { connect: { id: appSurvey.id } },
            },
          })
        );
      }

      await Promise.all(segmentPromises);
    },
    { timeout: 50000 }
  );
}

main()
  .catch(async (e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => await prisma.$disconnect());
