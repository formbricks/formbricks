/* eslint-disable -- leacy support workaround for now to avoid rewrite after eslint rules have been changed */
// migration script to add empty strings to welcome card headline in default language, if it does not exist
// WelcomeCard.headline = {} -> WelcomeCard.headline = {"default":""}
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const main = async () => {
  await prisma.$transaction(
    async (tx) => {
      const surveys = await tx.survey.findMany({
        select: {
          id: true,
          welcomeCard: true,
        },
      });

      if (surveys.length === 0) {
        // stop the migration if there are no surveys
        console.log("Stopping migration, no surveys found");
        return;
      }
      let count = 0;
      for (const survey of surveys) {
        const updatedSurvey = structuredClone(survey) as any;
        if (
          updatedSurvey.welcomeCard &&
          updatedSurvey.welcomeCard.headline &&
          Object.keys(updatedSurvey.welcomeCard.headline).length === 0
        ) {
          updatedSurvey.welcomeCard.headline["default"] = "";
          count++;
          await tx.survey.update({
            where: { id: survey.id },
            data: { ...updatedSurvey },
          });
        }
      }
      console.log(count, "surveys transformed");
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
