/* eslint-disable -- leacy support workaround for now to avoid rewrite after eslint rules have been changed */
// migration script to translate surveys where thankYouCard buttonLabel is a string or question subheaders are strings
import { PrismaClient } from "@prisma/client";
import { hasStringSubheaders, translateSurvey } from "./lib/i18n";

const prisma = new PrismaClient();

const main = async () => {
  await prisma.$transaction(
    async (tx) => {
      // Translate Surveys
      const surveys: any = await tx.survey.findMany({
        select: {
          id: true,
          questions: true,
          thankYouCard: true,
          welcomeCard: true,
        },
      });

      for (const survey of surveys) {
        if (typeof survey.thankYouCard.buttonLabel === "string" || hasStringSubheaders(survey.questions)) {
          const translatedSurvey = translateSurvey(survey, []);

          // Save the translated survey
          await tx.survey.update({
            where: { id: survey.id },
            data: { ...translatedSurvey },
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
