/* eslint-disable @typescript-eslint/restrict-template-expressions  -- using template strings for logging */

/* eslint-disable no-console -- logging is allowed in migration scripts */
import { PrismaClient } from "@prisma/client";
import {
  type TSurveyQuestion,
  type TSurveyQuestionId,
  TSurveyQuestionTypeEnum,
} from "@formbricks/types/surveys/types";

const prisma = new PrismaClient();

async function runMigration(): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      const startTime = Date.now();
      console.log("Starting data migration...");

      // Get all surveys with status not in draft and questions containing cta or consent
      const relevantSurveys = await tx.survey.findMany({
        where: {
          status: {
            notIn: ["draft"],
          },
          OR: [
            {
              questions: {
                array_contains: [{ type: "cta" }],
              },
            },
            {
              questions: {
                array_contains: [{ type: "consent" }],
              },
            },
          ],
        },
        select: {
          id: true,
          questions: true,
        },
      });

      // Process each survey
      const migrationPromises = relevantSurveys.map(async (survey) => {
        const ctaOrConsentQuestionIds = survey.questions
          .filter(
            (ques: TSurveyQuestion) =>
              ques.type === TSurveyQuestionTypeEnum.CTA || ques.type === TSurveyQuestionTypeEnum.Consent
          )
          .map((ques: TSurveyQuestion) => ques.id);

        const responses = await tx.response.findMany({
          where: { surveyId: survey.id },
          select: { id: true, data: true },
        });

        return Promise.all(
          responses.map(async (response) => {
            const updatedData = { ...response.data };

            ctaOrConsentQuestionIds.forEach((questionId: TSurveyQuestionId) => {
              if (updatedData[questionId] && updatedData[questionId] === "dismissed") {
                updatedData[questionId] = "";
              }
            });

            return tx.response.update({
              where: { id: response.id },
              data: { data: updatedData },
            });
          })
        );
      });

      await Promise.all(migrationPromises);

      console.log(`Updated ${migrationPromises.length} questions in  ${relevantSurveys.length} surveys`);

      const endTime = Date.now();
      console.log(`Data migration completed. Total time: ${((endTime - startTime) / 1000).toString()}s`);
    },
    {
      timeout: 900000, // 15 minutes
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
