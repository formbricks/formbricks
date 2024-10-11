/* eslint-disable -- leacy support workaround for now to avoid rewrite after eslint rules have been changed */
// migration script to convert range field in rating question from string to number
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const main = async () => {
  await prisma.$transaction(
    async (tx) => {
      const surveys = await tx.survey.findMany({
        select: {
          id: true,
          questions: true,
        },
      });

      if (surveys.length === 0) {
        // stop the migration if there are no surveys
        return;
      }

      for (const survey of surveys) {
        let updateNeeded = false;
        const updatedSurvey = structuredClone(survey) as any;
        if (updatedSurvey.questions.length > 0) {
          for (const question of updatedSurvey.questions) {
            if (question.type === "rating" && typeof question.range === "string") {
              const parsedRange = parseInt(question.range);
              if (!isNaN(parsedRange)) {
                updateNeeded = true;
                question.range = parsedRange;
              } else {
                throw new Error(`Invalid range value for question Id ${question.id}: ${question.range}`);
              }
            }
          }
        }
        if (updateNeeded) {
          // Save the translated survey
          await tx.survey.update({
            where: { id: survey.id },
            data: { ...updatedSurvey },
          });
        }
      }
    },
    {
      timeout: 50000,
    }
  );
};

main()
  .catch(async (e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => await prisma.$disconnect());
