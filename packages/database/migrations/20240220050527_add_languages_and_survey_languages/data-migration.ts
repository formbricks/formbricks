import { PrismaClient } from "@prisma/client";

import { translateSurvey } from "./lib/i18n";

const prisma = new PrismaClient();

async function main() {
  await prisma.$transaction(async (tx) => {
    const surveys = await tx.survey.findMany({
      select: {
        id: true,
        questions: true,
        thankYouCard: true,
        welcomeCard: true,
      },
    });

    if (!surveys) {
      // stop the migration if there are no surveys
      return;
    }

    for (const survey of surveys) {
      if (survey.questions.length > 0 && typeof survey.questions[0].headline === "string") {
        const translatedSurvey = translateSurvey(survey, []);

        // Save the translated survey
        await tx.survey.update({
          where: { id: survey.id },
          data: { ...translatedSurvey },
        });
      }
    }
  });
}

main()
  .catch(async (e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => await prisma.$disconnect());
