/* eslint-disable no-console -- logging is allowed in migration scripts */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function runMigration(): Promise<void> {
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

      console.log(`Deleted ${segmentsWithNoSurveys.length.toString()} segments with no surveys`);

      const appSurveysWithoutSegment = await tx.survey.findMany({
        where: {
          type: "app",
          segmentId: null,
        },
      });

      console.log(`Found ${appSurveysWithoutSegment.length.toString()} app surveys without a segment`);

      const segmentPromises = appSurveysWithoutSegment.map((appSurvey) =>
        tx.segment.create({
          data: {
            title: appSurvey.id,
            isPrivate: true,
            environment: { connect: { id: appSurvey.environmentId } },
            surveys: { connect: { id: appSurvey.id } },
          },
        })
      );

      await Promise.all(segmentPromises);
      console.log("Migration completed");
    },
    { timeout: 50000 }
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
