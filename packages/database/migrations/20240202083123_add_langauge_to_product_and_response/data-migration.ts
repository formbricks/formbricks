import { PrismaClient } from "@prisma/client";

import { translateSurvey } from "@formbricks/lib/i18n/utils";
import { selectSurvey, updateSurvey } from "@formbricks/lib/survey/service";

const prisma = new PrismaClient();

async function main() {
  await prisma.$transaction(async (tx) => {
    const surveys = await prisma.survey.findMany({
      include: selectSurvey,
    });

    if (!surveys) {
      // stop the migration if there are no surveys
      return;
    }

    for (const survey of surveys) {
      if (survey.questions.length > 0 && typeof survey.questions[0].headline === "string") {
        const transformedSurvey = {
          ...survey,
          triggers: survey.triggers.map((trigger) => trigger.actionClass.name),
        };
        const translatedSurvey = translateSurvey(transformedSurvey, { en: "English" }, "en");

        // Save the translated survey
        await updateSurvey(translatedSurvey, tx);
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
