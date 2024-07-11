import { PrismaClient } from "@prisma/client";
import { ZodError } from "zod";
import { ZSurvey } from "@formbricks/types/surveys/types";

export const transformErrorToDetails = (error: ZodError<any>): { [key: string]: string } => {
  const details: { [key: string]: string } = {};
  for (const issue of error.issues) {
    details[issue.path.join(".")] = issue.message;
  }
  return details;
};

const prisma = new PrismaClient();

async function main() {
  await prisma.$transaction(
    async (tx) => {
      const surveys = await tx.survey.findMany({});

      // safe parse each survey with zod
      for (const survey of surveys) {
        const surveyParsingResult = ZSurvey.safeParse(survey);
        if (!surveyParsingResult.success) {
          console.log(
            `Error parsing survey ${survey.id}: \n`,
            transformErrorToDetails(surveyParsingResult.error),
            "\n",
            "-----------------",
            "\n"
          );
        }
      }
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
