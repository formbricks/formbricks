import { prisma } from "@formbricks/database";
import { z } from "zod";
import { ValidationError } from "@formbricks/errors";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/errors";
import {
  TSurvey,
  TSurveyWithAnalytics,
  ZSurvey,
  ZSurveyWithAnalytics
} from "@formbricks/types/v1/surveys";
import { Prisma } from "@prisma/client";
import "server-only";
import { cache } from "react";

export const select = {
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
  redirectUrl: true,
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
displays:{
  select:{
    status:true,
    id:true
  }
},
_count:{
  select:{
    responses:true
  }
}
}

export const preloadSurvey = (surveyId: string) => {
  void getSurvey(surveyId);
};

export const getSurvey = cache(async (surveyId: string): Promise<TSurveyWithAnalytics | null> => {
  let surveyPrisma;
  try {
    surveyPrisma = await prisma.survey.findUnique({
      where: {
        id: surveyId,
      },
      select
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

  let {_count,displays, ...surveyPrismaFields}=surveyPrisma;

  const numDisplays=displays.length
  const numDisplaysResponded=displays.filter((item)=>item.status==='responded').length
  const numResponses=_count.responses
  // responseRate, rounded to 2 decimal places
  const responseRate = numDisplays ? Math.round((numDisplaysResponded / numDisplays) * 100) / 100 : 0;
  
  const transformedSurvey = {
    ...surveyPrismaFields,
    triggers: surveyPrismaFields.triggers.map((trigger) => trigger.eventClass),
    analytics: {
      numDisplays,
      responseRate,
      numResponses
    },
  };

  try {
    const survey = ZSurveyWithAnalytics.parse(transformedSurvey);
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
      select,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }

    throw error;
  }

  const surveys: TSurvey[] = [];
  for (const {_count,displays, ...surveyPrisma} of surveysPrisma) {
    const transformedSurvey = {
      ...surveyPrisma,
      triggers: surveyPrisma.triggers.map((trigger) => trigger.eventClass),
    };
    const survey = ZSurvey.parse(transformedSurvey);
    surveys.push(survey);
  }

  try {
    return surveys;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(JSON.stringify(error.errors, null, 2)); // log the detailed error information
    }
    throw new ValidationError("Data validation of survey failed");
  }
});

export const getSurveysWithAnalytics = cache(async (environmentId: string): Promise<TSurveyWithAnalytics[]> => {
  let surveysPrisma;
  try {
    surveysPrisma = await prisma.survey.findMany({
      where: {
        environmentId,
      },
      select
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }

    throw error;
  }

  const surveys: TSurveyWithAnalytics[] = [];
  for (const {_count,displays, ...surveyPrisma} of surveysPrisma) {
    const numDisplays=displays.length
    const numDisplaysResponded=displays.filter((item)=>item.status==='responded').length
    const responseRate = numDisplays ? Math.round((numDisplaysResponded / numDisplays) * 100) / 100 : 0;

    const transformedSurvey = {
      ...surveyPrisma,
      triggers: surveyPrisma.triggers.map((trigger) => trigger.eventClass),
      analytics:{
        numDisplays,
        responseRate,
        numResponses:_count.responses
      }
    };
    const survey = ZSurveyWithAnalytics.parse(transformedSurvey);
    surveys.push(survey);
  }

  try {
    return surveys;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(JSON.stringify(error.errors, null, 2)); // log the detailed error information
    }
    throw new ValidationError("Data validation of survey failed");
  }
});
