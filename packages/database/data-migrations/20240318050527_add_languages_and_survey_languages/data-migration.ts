/* eslint-disable -- leacy support workaround for now to avoid rewrite after eslint rules have been changed */
import { PrismaClient } from "@prisma/client";
import { AttributeType } from "@prisma/client";
import { translateSurvey } from "./lib/i18n";

const prisma = new PrismaClient();

const main = async () => {
  await prisma.$transaction(
    async (tx) => {
      // Translate Surveys
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
        console.log("No survey found");
        return;
      }
      console.log("Translating surveys");
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
      console.log("Survey translation completed");

      // Add language attributeClass
      const environments = await tx.environment.findMany({
        select: {
          id: true,
          attributeClasses: true,
        },
      });

      if (!environments) {
        console.log("No environments found");
        // stop the migration if there are no environments
        return;
      }

      console.log("Adding language attribute class");
      for (const environment of environments) {
        const languageAttributeClass = environment.attributeClasses.find((attributeClass) => {
          return attributeClass.name === "language";
        });
        if (languageAttributeClass) {
          // Update existing attributeClass if needed
          if (
            languageAttributeClass.type === AttributeType.automatic &&
            languageAttributeClass.description === "The language used by the person"
          ) {
            continue;
          }

          await tx.attributeClass.update({
            where: { id: languageAttributeClass.id },
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
      console.log("Adding language attribute class finished");
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
