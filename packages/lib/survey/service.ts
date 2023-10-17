import "server-only";

import { prisma } from "@formbricks/database";
import { ZString } from "@formbricks/types/v1/common";
import { ZId } from "@formbricks/types/v1/environment";
import { DatabaseError, ResourceNotFoundError, ValidationError } from "@formbricks/types/v1/errors";
import {
  TSurvey,
  TSurveyAttributeFilter,
  TSurveyInput,
  TSurveyWithAnalytics,
  ZSurvey,
} from "@formbricks/types/v1/surveys";
import { Prisma } from "@prisma/client";
import { revalidateTag, unstable_cache } from "next/cache";
import { z } from "zod";
import { getActionClasses } from "../actionClass/service";
import { SERVICES_REVALIDATION_INTERVAL } from "../constants";
import { getDisplaysCacheTag } from "../display/service";
import { getResponsesCacheTag } from "../response/service";
import { captureTelemetry } from "../telemetry";
import { validateInputs } from "../utils/validate";
import { formatSurveyDateFields } from "./util";

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
  welcomeCard: true,
  questions: true,
  thankYouCard: true,
  hiddenFields: true,
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
  pin: true,
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
      responseId: true,
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
  validateInputs([surveyId, ZString]);

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
          console.error(error.message);
          throw new DatabaseError("Database operation failed");
        }

        throw error;
      }

      if (!surveyPrisma) {
        throw new ResourceNotFoundError("Survey", surveyId);
      }

      let { _count, displays, ...surveyPrismaFields } = surveyPrisma;

      const numDisplays = displays.length;
      const numDisplaysResponded = displays.filter((item) => {
        return item.status === "responded" || item.responseId;
      }).length;
      const numResponses = _count.responses;
      // responseRate, rounded to 2 decimal places
      const responseRate = numDisplays ? Math.round((numDisplaysResponded / numDisplays) * 100) / 100 : 0;

      const transformedSurvey = {
        ...surveyPrismaFields,
        triggers: surveyPrismaFields.triggers.map((trigger) => trigger.eventClass.name),
        analytics: {
          numDisplays,
          responseRate,
          numResponses,
        },
      };

      return transformedSurvey;
    },
    [`surveyWithAnalytics-${surveyId}`],
    {
      tags: [getSurveyCacheTag(surveyId), getDisplaysCacheTag(surveyId), getResponsesCacheTag(surveyId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

  if (!survey) {
    return null;
  }

  // since the unstable_cache function does not support deserialization of dates, we need to manually deserialize them
  // https://github.com/vercel/next.js/issues/51613
  return {
    ...survey,
    ...formatSurveyDateFields(survey),
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
          console.error(error.message);
          throw new DatabaseError("Database operation failed");
        }

        throw error;
      }

      if (!surveyPrisma) {
        return null;
      }

      const transformedSurvey = {
        ...surveyPrisma,
        triggers: surveyPrisma.triggers.map((trigger) => trigger.eventClass.name),
      };

      return transformedSurvey;
    },
    [`surveys-${surveyId}`],
    {
      tags: [getSurveyCacheTag(surveyId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

  if (!survey) {
    return null;
  }

  // since the unstable_cache function does not support deserialization of dates, we need to manually deserialize them
  // https://github.com/vercel/next.js/issues/51613
  return {
    ...survey,
    ...formatSurveyDateFields(survey),
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

  for (const surveyPrisma of surveysPrisma) {
    const transformedSurvey = {
      ...surveyPrisma,
      triggers: surveyPrisma.triggers.map((trigger) => trigger.eventClass.name),
    };
    surveys.push(transformedSurvey);
  }
  return surveys;
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

  for (const surveyPrisma of surveysPrisma) {
    const transformedSurvey = {
      ...surveyPrisma,
      triggers: surveyPrisma.triggers.map((trigger) => trigger.eventClass.name),
    };
    surveys.push(transformedSurvey);
  }
  return surveys;
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
          console.error(error.message);
          throw new DatabaseError("Database operation failed");
        }

        throw error;
      }

      const surveys: TSurvey[] = [];

      for (const surveyPrisma of surveysPrisma) {
        const transformedSurvey = {
          ...surveyPrisma,
          triggers: surveyPrisma.triggers.map((trigger) => trigger.eventClass.name),
        };
        surveys.push(transformedSurvey);
      }
      return surveys;
    },
    [`environments-${environmentId}-surveys`],
    {
      tags: [getSurveysCacheTag(environmentId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

  // since the unstable_cache function does not support deserialization of dates, we need to manually deserialize them
  // https://github.com/vercel/next.js/issues/51613
  return surveys.map((survey) => ({
    ...survey,
    ...formatSurveyDateFields(survey),
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
          console.error(error.message);
          throw new DatabaseError("Database operation failed");
        }

        throw error;
      }

      try {
        const surveys: TSurveyWithAnalytics[] = [];
        for (const { _count, displays, ...surveyPrisma } of surveysPrisma) {
          const numDisplays = displays.length;
          const numDisplaysResponded = displays.filter((item) => {
            return item.status === "responded" || item.responseId;
          }).length;
          const responseRate = numDisplays ? Math.round((numDisplaysResponded / numDisplays) * 100) / 100 : 0;

          const transformedSurvey = {
            ...surveyPrisma,
            triggers: surveyPrisma.triggers.map((trigger) => trigger.eventClass.name),
            analytics: {
              numDisplays,
              responseRate,
              numResponses: _count.responses,
            },
          };
          surveys.push(transformedSurvey);
        }
        return surveys;
      } catch (error) {
        if (error instanceof Error) {
          console.error(error.message);
        }
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
    ...formatSurveyDateFields(survey),
  }));
};

export async function updateSurvey(updatedSurvey: TSurvey): Promise<TSurvey> {
  validateInputs([updatedSurvey, ZSurvey]);

  const surveyId = updatedSurvey.id;
  let data: any = {};

  const actionClasses = await getActionClasses(updatedSurvey.environmentId);
  const currentSurvey = await getSurvey(surveyId);

  if (!currentSurvey) {
    throw new ResourceNotFoundError("Survey", surveyId);
  }

  const { triggers, attributeFilters, environmentId, ...surveyData } = updatedSurvey;

  if (triggers) {
    const newTriggers: string[] = [];
    const removedTriggers: string[] = [];
    // find added triggers
    for (const trigger of triggers) {
      if (!trigger) {
        continue;
      }
      if (currentSurvey.triggers.find((t) => t === trigger)) {
        continue;
      } else {
        newTriggers.push(trigger);
      }
    }
    // find removed triggers
    for (const trigger of currentSurvey.triggers) {
      if (triggers.find((t: any) => t === trigger)) {
        continue;
      } else {
        removedTriggers.push(trigger);
      }
    }
    // create new triggers
    if (newTriggers.length > 0) {
      data.triggers = {
        ...(data.triggers || []),
        create: newTriggers.map((trigger) => ({
          eventClassId: actionClasses.find((actionClass) => actionClass.name === trigger)!.id,
        })),
      };
    }
    // delete removed triggers
    if (removedTriggers.length > 0) {
      data.triggers = {
        ...(data.triggers || []),
        deleteMany: {
          eventClassId: {
            in: removedTriggers.map(
              (trigger) => actionClasses.find((actionClass) => actionClass.name === trigger)!.id
            ),
          },
        },
      };
    }
  }

  if (attributeFilters) {
    const newFilters: TSurveyAttributeFilter[] = [];
    const removedFilterIds: string[] = [];
    // find added attribute filters
    for (const attributeFilter of attributeFilters) {
      if (!attributeFilter.attributeClassId || !attributeFilter.condition || !attributeFilter.value) {
        continue;
      }
      if (
        currentSurvey.attributeFilters.find(
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
    for (const attributeFilter of currentSurvey.attributeFilters) {
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
  }

  data = {
    ...surveyData,
    ...data,
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
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error(error.message);
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

export async function createSurvey(environmentId: string, surveyBody: TSurveyInput): Promise<TSurvey> {
  validateInputs([environmentId, ZId]);

  // TODO: Create with triggers & attributeFilters
  delete surveyBody.triggers;
  delete surveyBody.attributeFilters;
  const data: Omit<TSurveyInput, "triggers" | "attributeFilters"> = {
    ...surveyBody,
  };

  const survey = await prisma.survey.create({
    data: {
      ...data,
      environment: {
        connect: {
          id: environmentId,
        },
      },
    },
    select: selectSurvey,
  });

  const transformedSurvey = {
    ...survey,
    triggers: survey.triggers.map((trigger) => trigger.eventClass.name),
  };

  captureTelemetry("survey created");

  revalidateTag(getSurveysCacheTag(environmentId));
  revalidateTag(getSurveyCacheTag(survey.id));

  return transformedSurvey;
}

export async function duplicateSurvey(environmentId: string, surveyId: string) {
  const existingSurvey = await getSurvey(surveyId);

  if (!existingSurvey) {
    throw new ResourceNotFoundError("Survey", surveyId);
  }

  const actionClasses = await getActionClasses(environmentId);

  // create new survey with the data of the existing survey
  const newSurvey = await prisma.survey.create({
    data: {
      ...existingSurvey,
      id: undefined, // id is auto-generated
      environmentId: undefined, // environmentId is set below
      name: `${existingSurvey.name} (copy)`,
      status: "draft",
      questions: JSON.parse(JSON.stringify(existingSurvey.questions)),
      thankYouCard: JSON.parse(JSON.stringify(existingSurvey.thankYouCard)),
      triggers: {
        create: existingSurvey.triggers.map((trigger) => ({
          eventClassId: actionClasses.find((actionClass) => actionClass.name === trigger)!.id,
        })),
      },
      attributeFilters: {
        create: existingSurvey.attributeFilters.map((attributeFilter) => ({
          attributeClassId: attributeFilter.attributeClassId,
          condition: attributeFilter.condition,
          value: attributeFilter.value,
        })),
      },
      environment: {
        connect: {
          id: environmentId,
        },
      },
      surveyClosedMessage: existingSurvey.surveyClosedMessage
        ? JSON.parse(JSON.stringify(existingSurvey.surveyClosedMessage))
        : Prisma.JsonNull,
      singleUse: existingSurvey.singleUse
        ? JSON.parse(JSON.stringify(existingSurvey.singleUse))
        : Prisma.JsonNull,
      productOverwrites: existingSurvey.productOverwrites
        ? JSON.parse(JSON.stringify(existingSurvey.productOverwrites))
        : Prisma.JsonNull,
      verifyEmail: existingSurvey.verifyEmail
        ? JSON.parse(JSON.stringify(existingSurvey.verifyEmail))
        : Prisma.JsonNull,
    },
  });

  revalidateTag(getSurveysCacheTag(environmentId));
  revalidateTag(getSurveyCacheTag(surveyId));

  return newSurvey;
}
