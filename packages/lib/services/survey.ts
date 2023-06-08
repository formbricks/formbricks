import { prisma } from "@formbricks/database";
import { TSurvey, ZSurvey } from "@formbricks/types/v1/surveys";

export const getSurvey = async (surveyId: string): Promise<TSurvey | null> => {
  const surveyPrisma = await prisma.survey.findUnique({
    where: {
      id: surveyId,
    },
    include: {
      triggers: {
        select: {
          eventClass: {
            select: {
              id: true,
              name: true,
              description: true,
              type: true,
              noCodeConfig: true,
            },
          },
        },
      },
      attributeFilters: {
        select: {
          id: true,
          attributeClassId: true,
          condition: true,
          value: true,
        },
      },
    },
  });

  if (!surveyPrisma) {
    return null;
  }

  const numDisplays = await prisma.display.count({
    where: {
      surveyId,
    },
  });

  const numDisplaysResponded = await prisma.display.count({
    where: {
      surveyId,
      status: "responded",
    },
  });

  // responseRate, rounded to 2 decimal places
  const responseRate = Math.round((numDisplaysResponded / numDisplays) * 100) / 100;

  const transformedSurvey = {
    ...surveyPrisma,
    createdAt: surveyPrisma.createdAt.toISOString(),
    updatedAt: surveyPrisma.updatedAt.toISOString(),
    triggers: surveyPrisma.triggers.map((trigger) => trigger.eventClass),
    analytics: {
      numDisplays,
      responseRate,
    },
  };

  const survey = ZSurvey.parse(transformedSurvey);

  return survey;
};
