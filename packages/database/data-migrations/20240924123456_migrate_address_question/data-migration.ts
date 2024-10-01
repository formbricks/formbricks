/* eslint-disable no-console -- logging is allowed in migration scripts */
import { PrismaClient } from "@prisma/client";
import { type TSurveyAddressQuestion, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";

const prisma = new PrismaClient();
const TRANSACTION_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds

async function runMigration(): Promise<void> {
  const startTime = Date.now();
  console.log("Starting data migration...");

  await prisma.$transaction(
    async (transactionPrisma) => {
      const surveysWithAddressQuestion = await transactionPrisma.survey.findMany({
        where: {
          questions: {
            array_contains: [{ type: "address" }],
          },
        },
      });

      console.log(`Found ${surveysWithAddressQuestion.length.toString()} surveys with address questions`);

      const updationPromises = [];
      const updatedQuestions = [];

      for (const survey of surveysWithAddressQuestion) {
        for (let question of survey.questions) {
          if (question.type === TSurveyQuestionTypeEnum.Address) {
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- addressLine1 is not defined for unmigrated surveys
            if (question.addressLine1 !== undefined) {
              break;
            }

            const {
              isAddressLine1Required,
              isAddressLine2Required,
              isCityRequired,
              isStateRequired,
              isZipRequired,
              isCountryRequired,
              ...rest
            } = question as TSurveyAddressQuestion & {
              isAddressLine1Required: boolean;
              isAddressLine2Required: boolean;
              isCityRequired: boolean;
              isStateRequired: boolean;
              isZipRequired: boolean;
              isCountryRequired: boolean;
            };

            question = {
              ...rest,
              addressLine1: { show: true, required: isAddressLine1Required },
              addressLine2: { show: true, required: isAddressLine2Required },
              city: { show: true, required: isCityRequired },
              state: { show: true, required: isStateRequired },
              zip: { show: true, required: isZipRequired },
              country: { show: true, required: isCountryRequired },
            };

            updatedQuestions.push(question);
          }
        }

        if (updatedQuestions.length > 0) {
          updationPromises.push(
            transactionPrisma.survey.update({
              where: {
                id: survey.id,
              },
              data: {
                questions: updatedQuestions,
              },
            })
          );
        }
      }

      if (updationPromises.length === 0) {
        console.log("No surveys require migration... Exiting");
        return;
      }

      await Promise.all(updationPromises);

      console.log("Data migration completed");
    },
    {
      timeout: TRANSACTION_TIMEOUT,
    }
  );

  const endTime = Date.now();
  console.log(`Data migration completed. Total time: ${((endTime - startTime) / 1000).toFixed(2)}s`);
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
