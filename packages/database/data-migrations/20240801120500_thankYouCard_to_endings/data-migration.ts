/* eslint-disable no-console -- logging is allowed in migration scripts */
import { createId } from "@paralleldrive/cuid2";
import { PrismaClient } from "@prisma/client";
import { type TSurveyEndings } from "@formbricks/types/surveys/types";

interface Survey {
  id: string;
  thankYouCard: {
    enabled: boolean;
    title: string;
    description: string;
  } | null;
  redirectUrl: string | null;
}
interface UpdatedSurvey extends Survey {
  endings?: TSurveyEndings;
}

const prisma = new PrismaClient();

async function runMigration(): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      const startTime = Date.now();
      console.log("Starting data migration...");

      // Fetch all surveys
      const surveys: Survey[] = (await tx.survey.findMany({
        select: {
          id: true,
          thankYouCard: true,
          redirectUrl: true,
        },
      })) as Survey[];

      if (surveys.length === 0) {
        // Stop the migration if there are no surveys
        console.log("No Surveys found");
        return;
      }

      console.log(`Total surveys found: ${surveys.length.toString()}`);
      let transformedSurveyCount = 0;

      const updatePromises = surveys
        .filter((s) => s.thankYouCard !== null)
        .map((survey) => {
          transformedSurveyCount++;
          const updatedSurvey: UpdatedSurvey = structuredClone(survey) as UpdatedSurvey;

          if (survey.redirectUrl) {
            updatedSurvey.endings = [
              {
                type: "redirectToUrl",
                label: "Redirect Url",
                id: createId(),
                url: survey.redirectUrl,
              },
            ];
          } else if (survey.thankYouCard?.enabled) {
            updatedSurvey.endings = [
              {
                ...survey.thankYouCard,
                type: "endScreen",
                id: createId(),
              },
            ];
          } else {
            updatedSurvey.endings = [];
          }

          // Return the update promise
          return tx.survey.update({
            where: { id: survey.id },
            data: {
              endings: updatedSurvey.endings,
              thankYouCard: null,
              redirectUrl: null,
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
