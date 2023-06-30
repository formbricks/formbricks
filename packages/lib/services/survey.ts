import { prisma } from "@formbricks/database";
import { z } from "zod";
import { ValidationError } from "@formbricks/errors";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/errors";
import { TSurvey, ZSurvey } from "@formbricks/types/v1/surveys";
import { Prisma } from "@prisma/client";
import "server-only";
import { cache } from "react";

export const preloadSurvey = (surveyId: string) => {
  void getSurvey(surveyId);
};

export const getSurvey = cache(async (surveyId: string): Promise<TSurvey | null> => {
  let surveyPrisma;
  try {
    surveyPrisma = await prisma.survey.findUnique({
      where: {
        id: surveyId,
      },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        name: true,
        type: true,
        environmentId: true,
        status: true,
        questions: true,
        thankYouCard: true,
        displayOption: true,
        recontactDays: true,
        autoClose: true,
        delay: true,
        autoComplete: true,
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
  const responseRate = numDisplays ? Math.round((numDisplaysResponded / numDisplays) * 100) / 100 : 0;

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
    if (error instanceof z.ZodError) {
      console.error(JSON.stringify(error.errors, null, 2)); // log the detailed error information
    }
    throw new ValidationError("Data validation of survey failed");
  }
});
