/* eslint-disable no-console -- logging is allowed in migration scripts */
import { PrismaClient } from "@prisma/client";
import { type TSurveyEnding, type TSurveyQuestion } from "@formbricks/types/surveys/types";

const prisma = new PrismaClient();

async function runMigration(): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      const startTime = Date.now();
      console.log("Starting data migration...");

      // Fetch all surveys
      const surveys: { id: string; questions: TSurveyQuestion[]; endings: TSurveyEnding[] }[] =
        await tx.survey.findMany({
          select: {
            id: true,
            questions: true,
            endings: true,
          },
        });

      if (surveys.length === 0) {
        // Stop the migration if there are no surveys
        console.log("No Surveys found");
        return;
      }

      // Get all surveys that have a logic rule that has "end" as the destination
      const surveysWithEndDestination = surveys.filter((survey) =>
        survey.questions.some((question) => question.logic?.some((rule) => rule.destination === "end"))
      );

      console.log(`Total surveys to update found: ${surveysWithEndDestination.length.toString()}`);

      let transformedSurveyCount = 0;

      const updatePromises = surveysWithEndDestination.map((survey) => {
        const updatedSurvey = structuredClone(survey);

        // Remove logic rule if there are no endings
        if (updatedSurvey.endings.length === 0) {
          // remove logic rule if there are no endings
          updatedSurvey.questions.forEach((question) => {
            if (typeof question.logic === "undefined") {
              return;
            }
            question.logic.forEach((rule, index) => {
              if (rule.destination === "end") {
                if (question.logic) question.logic.splice(index, 1);
              }
            });
          });
        }
        // get id of first ending
        const firstEnding = survey.endings[0];

        // replace logic destination with ending id
        updatedSurvey.questions.forEach((question) => {
          if (typeof question.logic === "undefined") {
            return;
          }
          question.logic.forEach((rule) => {
            if (rule.destination === "end") {
              rule.destination = firstEnding.id;
            }
          });
        });

        transformedSurveyCount++;

        // Return the update promise
        return tx.survey.update({
          where: { id: survey.id },
          data: {
            questions: updatedSurvey.questions,
          },
        });
      });

      await Promise.all(updatePromises);

      console.log(`${transformedSurveyCount.toString()} surveys transformed`);
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
