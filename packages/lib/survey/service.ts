import "server-only";

import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/v1/environment";
import { DatabaseError, ResourceNotFoundError, ValidationError } from "@formbricks/types/v1/errors";
import {
  TSurvey,
  TSurveyAttributeFilter,
  TSurveyWithAnalytics,
  ZSurvey,
  ZSurveyWithAnalytics,
} from "@formbricks/types/v1/surveys";
import { Prisma } from "@prisma/client";
import { revalidateTag, unstable_cache } from "next/cache";
import { z } from "zod";
import { captureTelemetry } from "../telemetry";
import { validateInputs } from "../utils/validate";
import { getDisplaysCacheTag } from "../display/service";
import { getResponsesCacheTag } from "../response/service";

// surveys cache key and tags
const getSurveysCacheTag = (environmentId: string): string => `environments-${environmentId}-surveys`;

// survey cache key and tags
export const getSurveyCacheTag = (surveyId: string): string => `surveys-${surveyId}`;

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
  productOverwrites: true,
  surveyClosedMessage: true,
  singleUse: true,
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

export const getSurveyWithAnalytics = async (surveyId: string): Promise<TSurveyWithAnalytics | null> => {
  const survey = await unstable_cache(
    async () => {
      validateInputs([surveyId, ZId]);
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
        console.error(error);
        if (error instanceof z.ZodError) {
          console.error(JSON.stringify(error.errors, null, 2)); // log the detailed error information
        }
        throw new ValidationError("Data validation of survey failed");
      }
    },
    [`surveyWithAnalytics-${surveyId}`],
    {
      tags: [getSurveyCacheTag(surveyId), getDisplaysCacheTag(surveyId), getResponsesCacheTag(surveyId)],
      revalidate: 60 * 30,
    }
  )();

  if (!survey) {
    return null;
  }

  // since the unstable_cache function does not support deserialization of dates, we need to manually deserialize them
  // https://github.com/vercel/next.js/issues/51613
  return {
    ...survey,
    createdAt: new Date(survey.createdAt),
    updatedAt: new Date(survey.updatedAt),
  };
};

export const getSurvey = async (surveyId: string): Promise<TSurvey | null> => {
  const survey = await unstable_cache(
    async () => {
      validateInputs([surveyId, ZId]);
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
    },
    [`surveys-${surveyId}`],
    {
      tags: [getSurveyCacheTag(surveyId)],
      revalidate: 60 * 30,
    }
  )();

  if (!survey) {
    return null;
  }

  // since the unstable_cache function does not support deserialization of dates, we need to manually deserialize them
  // https://github.com/vercel/next.js/issues/51613
  return {
    ...survey,
    createdAt: new Date(survey.createdAt),
    updatedAt: new Date(survey.updatedAt),
  };
};

export const getSurveysByAttributeClassId = async (attributeClassId: string): Promise<TSurvey[]> => {
  const surveysPrisma = await prisma.survey.findMany({
    where: {
      attributeFilters: {
        some: {
          attributeClassId,
        },
      },
    },
    select: selectSurvey,
  });

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
};

export const getSurveysByActionClassId = async (actionClassId: string): Promise<TSurvey[]> => {
  const surveysPrisma = await prisma.survey.findMany({
    where: {
      triggers: {
        some: {
          eventClass: {
            id: actionClassId,
          },
        },
      },
    },
    select: selectSurvey,
  });

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
};

export const getSurveys = async (environmentId: string): Promise<TSurvey[]> => {
  const surveys = await unstable_cache(
    async () => {
      validateInputs([environmentId, ZId]);
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
    },
    [`environments-${environmentId}-surveys`],
    {
      tags: [getSurveysCacheTag(environmentId)],
      revalidate: 60 * 30,
    }
  )();

  // since the unstable_cache function does not support deserialization of dates, we need to manually deserialize them
  // https://github.com/vercel/next.js/issues/51613
  return surveys.map((survey) => ({
    ...survey,
    createdAt: new Date(survey.createdAt),
    updatedAt: new Date(survey.updatedAt),
  }));
};

// TODO: Cache doesn't work for updated displays & responses
export const getSurveysWithAnalytics = async (environmentId: string): Promise<TSurveyWithAnalytics[]> => {
  const surveysWithAnalytics = await unstable_cache(
    async () => {
      validateInputs([environmentId, ZId]);
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
    },
    [`environments-${environmentId}-surveysWithAnalytics`],
    {
      tags: [getSurveysCacheTag(environmentId)], // TODO: add tags for displays and responses
    }
  )();

  // since the unstable_cache function does not support deserialization of dates, we need to manually deserialize them
  // https://github.com/vercel/next.js/issues/51613
  return surveysWithAnalytics.map((survey) => ({
    ...survey,
    createdAt: new Date(survey.createdAt),
    updatedAt: new Date(survey.updatedAt),
  }));
};

export async function updateSurvey(updatedSurvey: Partial<TSurvey>): Promise<TSurvey> {
  const surveyId = updatedSurvey.id;
  let data: any = {};
  let survey: any = { ...updatedSurvey };

  if (updatedSurvey.triggers && updatedSurvey.triggers.length > 0) {
    const modifiedTriggers = updatedSurvey.triggers.map((trigger) => {
      if (typeof trigger === "object" && trigger.id) {
        return trigger.id;
      } else if (typeof trigger === "string" && trigger !== undefined) {
        return trigger;
      }
    });

    survey = { ...updatedSurvey, triggers: modifiedTriggers };
  }

  const currentTriggers = await prisma.surveyTrigger.findMany({
    where: {
      surveyId,
    },
  });
  const currentAttributeFilters = await prisma.surveyAttributeFilter.findMany({
    where: {
      surveyId,
    },
  });

  delete survey.updatedAt;
  // preventing issue with unknowingly updating analytics
  delete survey.analytics;

  if (survey.type === "link") {
    delete survey.triggers;
    delete survey.recontactDays;
    // converts JSON field with null value to JsonNull as JSON fields can't be set to null since prisma 3.0
    if (!survey.surveyClosedMessage) {
      survey.surveyClosedMessage = null;
    }
  }

  if (survey.triggers) {
    const newTriggers: string[] = [];
    const removedTriggers: string[] = [];
    // find added triggers
    for (const eventClassId of survey.triggers) {
      if (!eventClassId) {
        continue;
      }
      if (currentTriggers.find((t) => t.eventClassId === eventClassId)) {
        continue;
      } else {
        newTriggers.push(eventClassId);
      }
    }
    // find removed triggers
    for (const trigger of currentTriggers) {
      if (survey.triggers.find((t: any) => t === trigger.eventClassId)) {
        continue;
      } else {
        removedTriggers.push(trigger.eventClassId);
      }
    }
    // create new triggers
    if (newTriggers.length > 0) {
      data.triggers = {
        ...(data.triggers || []),
        create: newTriggers.map((eventClassId) => ({
          eventClassId,
        })),
      };
    }
    // delete removed triggers
    if (removedTriggers.length > 0) {
      data.triggers = {
        ...(data.triggers || []),
        deleteMany: {
          eventClassId: {
            in: removedTriggers,
          },
        },
      };
    }
    delete survey.triggers;
  }

  const attributeFilters: TSurveyAttributeFilter[] = survey.attributeFilters;
  if (attributeFilters) {
    const newFilters: TSurveyAttributeFilter[] = [];
    const removedFilterIds: string[] = [];
    // find added attribute filters
    for (const attributeFilter of attributeFilters) {
      if (!attributeFilter.attributeClassId || !attributeFilter.condition || !attributeFilter.value) {
        continue;
      }
      if (
        currentAttributeFilters.find(
          (f) =>
            f.attributeClassId === attributeFilter.attributeClassId &&
            f.condition === attributeFilter.condition &&
            f.value === attributeFilter.value
        )
      ) {
        continue;
      } else {
        newFilters.push({
          attributeClassId: attributeFilter.attributeClassId,
          condition: attributeFilter.condition,
          value: attributeFilter.value,
        });
      }
    }
    // find removed attribute filters
    for (const attributeFilter of currentAttributeFilters) {
      if (
        attributeFilters.find(
          (f) =>
            f.attributeClassId === attributeFilter.attributeClassId &&
            f.condition === attributeFilter.condition &&
            f.value === attributeFilter.value
        )
      ) {
        continue;
      } else {
        removedFilterIds.push(attributeFilter.attributeClassId);
      }
    }
    // create new attribute filters
    if (newFilters.length > 0) {
      data.attributeFilters = {
        ...(data.attributeFilters || []),
        create: newFilters.map((attributeFilter) => ({
          attributeClassId: attributeFilter.attributeClassId,
          condition: attributeFilter.condition,
          value: attributeFilter.value,
        })),
      };
    }
    // delete removed triggers
    if (removedFilterIds.length > 0) {
      // delete all attribute filters that match the removed attribute classes
      await Promise.all(
        removedFilterIds.map(async (attributeClassId) => {
          await prisma.surveyAttributeFilter.deleteMany({
            where: {
              attributeClassId,
            },
          });
        })
      );
    }
    delete survey.attributeFilters;
  }

  data = {
    ...data,
    ...survey,
  };

  try {
    const prismaSurvey = await prisma.survey.update({
      where: { id: surveyId },
      data,
    });

    const modifiedSurvey: TSurvey = {
      ...prismaSurvey, // Properties from prismaSurvey
      triggers: updatedSurvey.triggers ? updatedSurvey.triggers : [], // Include triggers from updatedSurvey
      attributeFilters: updatedSurvey.attributeFilters ? updatedSurvey.attributeFilters : [], // Include attributeFilters from updatedSurvey
    };

    revalidateTag(getSurveysCacheTag(modifiedSurvey.environmentId));
    revalidateTag(getSurveyCacheTag(modifiedSurvey.id));

    return modifiedSurvey;
  } catch (error) {
    console.error(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }

    throw error;
  }
}

export async function deleteSurvey(surveyId: string) {
  validateInputs([surveyId, ZId]);
  const deletedSurvey = await prisma.survey.delete({
    where: {
      id: surveyId,
    },
    select: selectSurvey,
  });

  revalidateTag(getSurveysCacheTag(deletedSurvey.environmentId));
  revalidateTag(getSurveyCacheTag(surveyId));

  return deletedSurvey;
}

export async function createSurvey(environmentId: string, surveyBody: any) {
  validateInputs([environmentId, ZId]);
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

  revalidateTag(getSurveysCacheTag(environmentId));
  revalidateTag(getSurveyCacheTag(survey.id));

  return survey;
}
