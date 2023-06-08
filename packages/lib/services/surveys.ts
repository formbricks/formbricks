import { prisma } from "@formbricks/database";

export const getSurvey = async (surveyId: string) => {
  const survey = await prisma.survey.findUnique({
    where: {
      id: surveyId,
    },
  });
  return survey;
};
