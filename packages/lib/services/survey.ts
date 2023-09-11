import { prisma } from "@formbricks/database";
import { DatabaseError, ResourceNotFoundError, ValidationError } from "@formbricks/types/v1/errors";
import { TSurvey, TSurveyWithAnalytics, ZSurvey, ZSurveyWithAnalytics } from "@formbricks/types/v1/surveys";
import { Prisma } from "@prisma/client";
import { cache } from "react";
import "server-only";
import { z } from "zod";
import { captureTelemetry } from "../telemetry";

export const selectSurvey = {
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
  closeOnDate: true,
  delay: true,
  autoComplete: true,
  verifyEmail: true,
  redirectUrl: true,
  surveyClosedMessage: true,
  triggers: {
    select: {
      eventClass: {
        select: {
          id: true,
          createdAt: true,
          updatedAt: true,
          environmentId: true,
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
};

export const selectSurveyWithAnalytics = {
  ...selectSurvey,
  displays: {
    select: {
      status: true,
      id: true,
    },
  },
  _count: {
    select: {
      responses: true,
    },
  },
};

export const preloadSurveyWithAnalytics = (surveyId: string) => {
  void getSurveyWithAnalytics(surveyId);
};

export const getSurveyWithAnalytics = cache(
  async (surveyId: string): Promise<TSurveyWithAnalytics | null> => {
    let surveyPrisma;
    try {
      surveyPrisma = await prisma.survey.findUnique({
        where: {
          id: surveyId,
        },
        select: selectSurveyWithAnalytics,
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

    let { _count, displays, ...surveyPrismaFields } = surveyPrisma;

    const numDisplays = displays.length;
    const numDisplaysResponded = displays.filter((item) => item.status === "responded").length;
    const numResponses = _count.responses;
    // responseRate, rounded to 2 decimal places
    const responseRate = numDisplays ? Math.round((numDisplaysResponded / numDisplays) * 100) / 100 : 0;

    const transformedSurvey = {
      ...surveyPrismaFields,
      triggers: surveyPrismaFields.triggers.map((trigger) => trigger.eventClass),
      analytics: {
        numDisplays,
        responseRate,
        numResponses,
      },
    };

    try {
      const survey = ZSurveyWithAnalytics.parse(transformedSurvey);
      return survey;
    } catch (error) {
      console.log(error);
      if (error instanceof z.ZodError) {
        console.error(JSON.stringify(error.errors, null, 2)); // log the detailed error information
      }
      throw new ValidationError("Data validation of survey failed");
    }
  }
);

export const getSurvey = cache(async (surveyId: string): Promise<TSurvey | null> => {
  let surveyPrisma;
  try {
    surveyPrisma = await prisma.survey.findUnique({
      where: {
        id: surveyId,
      },
      select: selectSurvey,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }

    throw error;
  }

  if (!surveyPrisma) {
    return null;
  }

  const transformedSurvey = {
    ...surveyPrisma,
    triggers: surveyPrisma.triggers.map((trigger) => trigger.eventClass),
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

export const getSurveys = cache(async (environmentId: string): Promise<TSurvey[]> => {
  let surveysPrisma;
  try {
    surveysPrisma = await prisma.survey.findMany({
      where: {
        environmentId,
      },
      select: selectSurvey,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }

    throw error;
  }

  const surveys: TSurvey[] = [];

  try {
    for (const surveyPrisma of surveysPrisma) {
      const transformedSurvey = {
        ...surveyPrisma,
        triggers: surveyPrisma.triggers.map((trigger) => trigger.eventClass),
      };
      const survey = ZSurvey.parse(transformedSurvey);
      surveys.push(survey);
    }
    return surveys;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(JSON.stringify(error.errors, null, 2)); // log the detailed error information
    }
    throw new ValidationError("Data validation of survey failed");
  }
});

export const getSurveysWithAnalytics = cache(
  async (environmentId: string): Promise<TSurveyWithAnalytics[]> => {
    let surveysPrisma;
    try {
      surveysPrisma = await prisma.survey.findMany({
        where: {
          environmentId,
        },
        select: selectSurveyWithAnalytics,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError("Database operation failed");
      }

      throw error;
    }

    try {
      const surveys: TSurveyWithAnalytics[] = [];
      for (const { _count, displays, ...surveyPrisma } of surveysPrisma) {
        const numDisplays = displays.length;
        const numDisplaysResponded = displays.filter((item) => item.status === "responded").length;
        const responseRate = numDisplays ? Math.round((numDisplaysResponded / numDisplays) * 100) / 100 : 0;

        const transformedSurvey = {
          ...surveyPrisma,
          triggers: surveyPrisma.triggers.map((trigger) => trigger.eventClass),
          analytics: {
            numDisplays,
            responseRate,
            numResponses: _count.responses,
          },
        };
        const survey = ZSurveyWithAnalytics.parse(transformedSurvey);
        surveys.push(survey);
      }
      return surveys;
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error(JSON.stringify(error.errors, null, 2)); // log the detailed error information
      }
      throw new ValidationError("Data validation of survey failed");
    }
  }
);

export async function deleteSurvey(surveyId: string) {
  const deletedSurvey = await prisma.survey.delete({
    where: {
      id: surveyId,
    },
    select: selectSurvey,
  });
  return deletedSurvey;
}

export async function createSurvey(environmentId: string, surveyBody: any) {
  const survey = await prisma.survey.create({
    data: {
      ...surveyBody,
      environment: {
        connect: {
          id: environmentId,
        },
      },
    },
  });
  captureTelemetry("survey created");

  return survey;
}
