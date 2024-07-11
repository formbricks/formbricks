import { PrismaClient } from "@prisma/client";
import { ZodError } from "zod";
import { TSegment } from "@formbricks/types/segment";
import { TSurvey, ZSurvey } from "@formbricks/types/surveys/types";

export const transformErrorToDetails = (error: ZodError<any>): { [key: string]: string } => {
  const details: { [key: string]: string } = {};
  for (const issue of error.issues) {
    details[issue.path.join(".")] = issue.message;
  }
  return details;
};

export const transformPrismaSurvey = (surveyPrisma: any): TSurvey => {
  let segment: TSegment | null = null;

  if (surveyPrisma.segment) {
    segment = {
      ...surveyPrisma.segment,
      surveys: surveyPrisma.segment.surveys.map((survey: any) => survey.id),
    };
  }

  const transformedSurvey: TSurvey = {
    ...surveyPrisma,
    displayPercentage: Number(surveyPrisma.displayPercentage) || null,
    segment,
  };

  return transformedSurvey;
};

const prisma = new PrismaClient();

async function main() {
  await prisma.$transaction(
    async (tx) => {
      const prismaSurveys = await tx.survey.findMany({
        select: {
          id: true,
          createdAt: true,
          updatedAt: true,
          name: true,
          type: true,
          environmentId: true,
          createdBy: true,
          status: true,
          welcomeCard: true,
          questions: true,
          thankYouCard: true,
          hiddenFields: true,
          displayOption: true,
          recontactDays: true,
          displayLimit: true,
          autoClose: true,
          runOnDate: true,
          closeOnDate: true,
          delay: true,
          displayPercentage: true,
          autoComplete: true,
          verifyEmail: true,
          redirectUrl: true,
          productOverwrites: true,
          styling: true,
          surveyClosedMessage: true,
          singleUse: true,
          pin: true,
          resultShareKey: true,
          showLanguageSwitch: true,
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
          triggers: {
            select: {
              actionClass: {
                select: {
                  id: true,
                  createdAt: true,
                  updatedAt: true,
                  environmentId: true,
                  name: true,
                  description: true,
                  type: true,
                  key: true,
                  noCodeConfig: true,
                },
              },
            },
          },
          segment: {
            include: {
              surveys: {
                select: {
                  id: true,
                },
              },
            },
          },
        },
      });

      // safe parse each survey with zod
      let errors = 0;
      for (const survey of prismaSurveys) {
        const transformedSurvey = transformPrismaSurvey(survey);
        const surveyParsingResult = ZSurvey.safeParse(transformedSurvey);
        if (!surveyParsingResult.success) {
          errors += 1;
          console.log(
            `Error parsing survey ${survey.id}: \n`,
            transformErrorToDetails(surveyParsingResult.error),
            "\n",
            "-----------------",
            "\n"
          );
        }
      }

      console.log("Total surveys: ", prismaSurveys.length);
      console.log("Surveys parsed with errors: ", errors);
    },
    { timeout: 50000 }
  );
}

main()
  .catch(async (e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => await prisma.$disconnect());
