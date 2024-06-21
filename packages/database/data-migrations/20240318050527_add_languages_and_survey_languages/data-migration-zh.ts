// migration script for converting zh code for chinese language to zh-Hans
import { PrismaClient } from "@prisma/client";
import {
  TSurveyLanguage,
  TSurveyQuestion,
  TSurveyThankYouCard,
  TSurveyWelcomeCard,
} from "@formbricks/types/surveys";
import {
  updateLanguageCodeForQuestion,
  updateLanguageCodeForThankYouCard,
  updateLanguageCodeForWelcomeCard,
} from "./lib/i18n";

const prisma = new PrismaClient();

const main = async () => {
  await prisma.$transaction(
    async (tx) => {
      const startTime = Date.now();
      console.log("Starting data migration...");

      // Fetch all surveys
      const surveys: {
        id: string;
        questions: TSurveyQuestion[];
        welcomeCard: TSurveyWelcomeCard;
        thankYouCard: TSurveyThankYouCard;
        languages: TSurveyLanguage[];
      }[] = await tx.survey.findMany({
        select: {
          id: true,
          questions: true,
          welcomeCard: true,
          thankYouCard: true,
          languages: {
            select: {
              default: true,
              enabled: true,
              language: {
                select: {
                  id: true,
                  code: true,
                  alias: true,
                  createdAt: true,
                  updatedAt: true,
                },
              },
            },
          },
        },
      });

      if (surveys.length === 0) {
        // stop the migration if there are no surveys
        console.log("No Surveys found");
        return;
      }

      console.log(`Total surveys found:${surveys.length}`);
      let transformedSurveyCount = 0;

      for (const survey of surveys) {
        const containsChineseTranslations = survey.languages.find((surveyLanguage) => {
          return surveyLanguage.language.code === "zh";
        });
        if (!containsChineseTranslations) {
          continue;
        }
        const updatedSurvey = structuredClone(survey);
        console.log("Transforming survey with id:", survey.id);
        transformedSurveyCount++;
        // check welcome card
        updatedSurvey.welcomeCard = updateLanguageCodeForWelcomeCard(survey.welcomeCard, "zh", "zh-Hans");

        // check Thank you card
        updatedSurvey.thankYouCard = updateLanguageCodeForThankYouCard(survey.thankYouCard, "zh", "zh-Hans");

        // check questions
        if (updatedSurvey.questions.length > 0) {
          updatedSurvey.questions = survey.questions.map((question) => {
            return updateLanguageCodeForQuestion(question, "zh", "zh-Hans");
          });
        }
        // Save the translated survey
        await tx.survey.update({
          where: { id: survey.id },
          data: {
            welcomeCard: updatedSurvey.welcomeCard,
            thankYouCard: updatedSurvey.thankYouCard,
            questions: updatedSurvey.questions,
          },
        });
      }

      console.log(transformedSurveyCount, " surveys transformed");

      console.log("updating languages");
      await tx.language.updateMany({
        where: {
          code: "zh",
        },
        data: {
          code: "zh-Hans",
        },
      });
      console.log("survey language updated");
      const endTime = Date.now();
      console.log(`Data migration completed. Total time: ${(endTime - startTime) / 1000}s`);
    },
    {
      timeout: 180000, // 3 minutes
    }
  );
};

main()
  .catch((e: Error) => {
    console.error("Error during migration: ", e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
