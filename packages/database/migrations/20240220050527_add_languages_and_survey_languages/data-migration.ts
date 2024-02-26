import { PrismaClient } from "@prisma/client";
import { AttributeType } from "@prisma/client";

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

  await prisma.$transaction(async (tx) => {
    const environments = await tx.environment.findMany({
      select: {
        id: true,
        attributeClasses: true,
      },
    });

    if (!environments) {
      // stop the migration if there are no environments
      return;
    }

    for (const environment of environments) {
      const hasLanguageAttributeClass = environment.attributeClasses.find(
        (attributeClass) => attributeClass.name === "language"
      );
      if (hasLanguageAttributeClass) {
        // Update existing attributeClass
        const attributeClassId = environment.attributeClasses[0].id;
        await tx.attributeClass.update({
          where: { id: attributeClassId },
          data: {
            type: AttributeType.automatic,
            description: "The language used by the person",
          },
        });
      } else {
        // Create new attributeClass
        await tx.attributeClass.create({
          data: {
            name: "language",
            type: AttributeType.automatic,
            description: "The language used by the person",
            environment: {
              connect: { id: environment.id },
            },
          },
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
