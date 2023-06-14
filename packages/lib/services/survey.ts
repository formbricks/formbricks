import { prisma } from "@formbricks/database";
import { ValidationError } from "@formbricks/errors";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/errors";
import { TSurvey, ZSurvey } from "@formbricks/types/v1/surveys";
import { Prisma } from "@prisma/client";

export const getSurvey = async (surveyId: string): Promise<TSurvey | null> => {
  let surveyPrisma;
  try {
    surveyPrisma = await prisma.survey.findUnique({
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
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }

    throw error;
  }

  if (!surveyPrisma) {
    throw new ResourceNotFoundError("Survey", surveyId);
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
    triggers: surveyPrisma.triggers.map((trigger) => trigger.eventClass),
    analytics: {
      numDisplays,
      responseRate,
    },
  };

  try {
    const survey = ZSurvey.parse(transformedSurvey);
    return survey;
  } catch (error) {
    throw new ValidationError("Data validation of survey failed");
  }
};
