import "server-only";

import { Prisma } from "@prisma/client";
import { differenceInDays } from "date-fns";
import { unstable_cache } from "next/cache";

import { prisma } from "@formbricks/database";
import { TActionClassType } from "@formbricks/types/actionClasses";
import { TAction, TActionInput, ZAction, ZActionInput } from "@formbricks/types/actions";
import { ZOptionalNumber } from "@formbricks/types/common";
import { ZId } from "@formbricks/types/environment";
import { DatabaseError } from "@formbricks/types/errors";

import { actionClassCache } from "../actionClass/cache";
import { createActionClass, getActionClassByEnvironmentIdAndName } from "../actionClass/service";
import { ITEMS_PER_PAGE, SERVICES_REVALIDATION_INTERVAL } from "../constants";
import { createPerson, getPersonByUserId } from "../person/service";
import { surveyCache } from "../survey/cache";
import { formatDateFields } from "../utils/datetime";
import { validateInputs } from "../utils/validate";
import { actionCache } from "./cache";
import { getStartDateOfLastMonth, getStartDateOfLastQuarter, getStartDateOfLastWeek } from "./utils";

export const getLatestActionByEnvironmentId = async (environmentId: string): Promise<TAction | null> => {
  const action = await unstable_cache(
    async () => {
      validateInputs([environmentId, ZId]);

      try {
        const actionPrisma = await prisma.action.findFirst({
          where: {
            actionClass: {
              environmentId: environmentId,
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          include: {
            actionClass: true,
          },
        });
        if (!actionPrisma) {
          return null;
        }
        const action: TAction = {
          id: actionPrisma.id,
          createdAt: actionPrisma.createdAt,
          personId: actionPrisma.personId,
          properties: actionPrisma.properties,
          actionClass: actionPrisma.actionClass,
        };
        return action;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw new DatabaseError("Database operation failed");
        }

        throw error;
      }
    },
    [`getLastestActionByEnvironmentId-${environmentId}`],
    {
      tags: [actionCache.tag.byEnvironmentId(environmentId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

  // since the unstable_cache function does not support deserialization of dates, we need to manually deserialize them
  // https://github.com/vercel/next.js/issues/51613
  return action ? formatDateFields(action, ZAction) : null;
};

export const getLatestActionByPersonId = async (personId: string): Promise<TAction | null> => {
  const action = await unstable_cache(
    async () => {
      validateInputs([personId, ZId]);

      try {
        const actionPrisma = await prisma.action.findFirst({
          where: {
            personId,
          },
          orderBy: {
            createdAt: "desc",
          },
          include: {
            actionClass: true,
          },
        });

        if (!actionPrisma) {
          return null;
        }
        const action: TAction = {
          id: actionPrisma.id,
          createdAt: actionPrisma.createdAt,
          personId: actionPrisma.personId,
          properties: actionPrisma.properties,
          actionClass: actionPrisma.actionClass,
        };
        return action;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw new DatabaseError("Database operation failed");
        }

        throw error;
      }
    },
    [`getLastestActionByPersonId-${personId}`],
    {
      tags: [actionCache.tag.byPersonId(personId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

  // since the unstable_cache function does not support deserialization of dates, we need to manually deserialize them
  // https://github.com/vercel/next.js/issues/51613
  return action ? formatDateFields(action, ZAction) : null;
};

export const getActionsByPersonId = async (personId: string, page?: number): Promise<TAction[]> => {
  const actions = await unstable_cache(
    async () => {
      validateInputs([personId, ZId], [page, ZOptionalNumber]);

      const actionsPrisma = await prisma.action.findMany({
        where: {
          person: {
            id: personId,
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: page ? ITEMS_PER_PAGE : undefined,
        skip: page ? ITEMS_PER_PAGE * (page - 1) : undefined,
        include: {
          actionClass: true,
        },
      });

      return actionsPrisma.map((action) => ({
        id: action.id,
        createdAt: action.createdAt,
        personId: action.personId,
        properties: action.properties,
        actionClass: action.actionClass,
      }));
    },
    [`getActionsByPersonId-${personId}-${page}`],
    {
      tags: [actionCache.tag.byPersonId(personId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

  // Deserialize dates if caching does not support deserialization
  return actions.map((action) => formatDateFields(action, ZAction));
};

export const getActionsByEnvironmentId = async (environmentId: string, page?: number): Promise<TAction[]> => {
  const actions = await unstable_cache(
    async () => {
      validateInputs([environmentId, ZId], [page, ZOptionalNumber]);

      try {
        const actionsPrisma = await prisma.action.findMany({
          where: {
            actionClass: {
              environmentId: environmentId,
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          take: page ? ITEMS_PER_PAGE : undefined,
          skip: page ? ITEMS_PER_PAGE * (page - 1) : undefined,
          include: {
            actionClass: true,
          },
        });
        const actions: TAction[] = [];
        // transforming response to type TAction[]
        actionsPrisma.forEach((action) => {
          actions.push({
            id: action.id,
            createdAt: action.createdAt,
            // sessionId: action.sessionId,
            personId: action.personId,
            properties: action.properties,
            actionClass: action.actionClass,
          });
        });
        return actions;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw new DatabaseError("Database operation failed");
        }

        throw error;
      }
    },
    [`getActionsByEnvironmentId-${environmentId}-${page}`],
    {
      tags: [actionCache.tag.byEnvironmentId(environmentId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

  // since the unstable_cache function does not support deserialization of dates, we need to manually deserialize them
  // https://github.com/vercel/next.js/issues/51613

  return actions.map((action) => formatDateFields(action, ZAction));
};

export const createAction = async (data: TActionInput): Promise<TAction> => {
  validateInputs([data, ZActionInput]);

  const { environmentId, name, properties, userId } = data;

  let actionType: TActionClassType = "code";
  if (name === "Exit Intent (Desktop)" || name === "50% Scroll") {
    actionType = "automatic";
  }

  let person = await getPersonByUserId(environmentId, userId);

  if (!person) {
    // create person if it does not exist
    person = await createPerson(environmentId, userId);
  }

  let actionClass = await getActionClassByEnvironmentIdAndName(environmentId, name);

  if (!actionClass) {
    actionClass = await createActionClass(environmentId, {
      name,
      type: actionType,
      environmentId,
    });
  }

  const action = await prisma.action.create({
    data: {
      properties,
      person: {
        connect: {
          id: person.id,
        },
      },
      actionClass: {
        connect: {
          id: actionClass.id,
        },
      },
    },
  });

  actionCache.revalidate({
    environmentId,
    personId: person.id,
  });

  surveyCache.revalidate({
    environmentId,
  });

  return {
    id: action.id,
    createdAt: action.createdAt,
    personId: action.personId,
    properties: action.properties,
    actionClass,
  };
};

export const getActionCountInLastHour = async (actionClassId: string): Promise<number> =>
  unstable_cache(
    async () => {
      validateInputs([actionClassId, ZId]);

      try {
        const numEventsLastHour = await prisma.action.count({
          where: {
            actionClassId: actionClassId,
            createdAt: {
              gte: new Date(Date.now() - 60 * 60 * 1000),
            },
          },
        });
        return numEventsLastHour;
      } catch (error) {
        throw error;
      }
    },
    [`getActionCountInLastHour-${actionClassId}`],
    {
      tags: [actionClassCache.tag.byId(actionClassId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

export const getActionCountInLast24Hours = async (actionClassId: string): Promise<number> =>
  unstable_cache(
    async () => {
      validateInputs([actionClassId, ZId]);

      try {
        const numEventsLast24Hours = await prisma.action.count({
          where: {
            actionClassId: actionClassId,
            createdAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
            },
          },
        });
        return numEventsLast24Hours;
      } catch (error) {
        throw error;
      }
    },
    [`getActionCountInLast24Hours-${actionClassId}`],
    {
      tags: [actionClassCache.tag.byId(actionClassId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

export const getActionCountInLast7Days = async (actionClassId: string): Promise<number> =>
  unstable_cache(
    async () => {
      validateInputs([actionClassId, ZId]);

      try {
        const numEventsLast7Days = await prisma.action.count({
          where: {
            actionClassId: actionClassId,
            createdAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            },
          },
        });
        return numEventsLast7Days;
      } catch (error) {
        throw error;
      }
    },
    [`getActionCountInLast7Days-${actionClassId}`],
    {
      tags: [actionClassCache.tag.byId(actionClassId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

export const getActionCountInLastQuarter = async (actionClassId: string, personId: string): Promise<number> =>
  await unstable_cache(
    async () => {
      return await prisma.action.count({
        where: {
          personId,
          actionClass: {
            id: actionClassId,
          },
          createdAt: {
            gte: getStartDateOfLastQuarter(),
          },
        },
      });
    },
    [`getActionCountInLastQuarter-${actionClassId}-${personId}`],
    {
      tags: [actionClassCache.tag.byId(actionClassId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

export const getActionCountInLastMonth = async (actionClassId: string, personId: string): Promise<number> =>
  await unstable_cache(
    async () => {
      return await prisma.action.count({
        where: {
          personId,
          actionClass: {
            id: actionClassId,
          },
          createdAt: {
            gte: getStartDateOfLastMonth(),
          },
        },
      });
    },
    [`getActionCountInLastMonth-${actionClassId}-${personId}`],
    {
      tags: [actionClassCache.tag.byId(actionClassId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

export const getActionCountInLastWeek = async (actionClassId: string, personId: string): Promise<number> =>
  await unstable_cache(
    async () => {
      return await prisma.action.count({
        where: {
          personId,
          actionClass: {
            id: actionClassId,
          },
          createdAt: {
            gte: getStartDateOfLastWeek(),
          },
        },
      });
    },
    [`getActionCountInLastWeek-${actionClassId}-${personId}`],
    {
      tags: [actionClassCache.tag.byId(actionClassId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

export const getTotalOccurrencesForAction = async (
  actionClassId: string,
  personId: string
): Promise<number> =>
  await unstable_cache(
    async () => {
      const count = await prisma.action.count({
        where: {
          personId,
          actionClass: {
            id: actionClassId,
          },
        },
      });

      return count;
    },
    [`getTotalOccurrencesForAction-${actionClassId}-${personId}`],
    {
      tags: [actionClassCache.tag.byId(actionClassId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

export const getLastOccurrenceDaysAgo = async (
  actionClassId: string,
  personId: string
): Promise<number | null> =>
  await unstable_cache(
    async () => {
      const lastEvent = await prisma.action.findFirst({
        where: {
          personId,
          actionClass: {
            id: actionClassId,
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        select: {
          createdAt: true,
        },
      });

      if (!lastEvent) return null;
      return differenceInDays(new Date(), lastEvent.createdAt);
    },
    [`getLastOccurrenceDaysAgo-${actionClassId}-${personId}`],
    {
      tags: [actionClassCache.tag.byId(actionClassId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

export const getFirstOccurrenceDaysAgo = async (
  actionClassId: string,
  personId: string
): Promise<number | null> =>
  await unstable_cache(
    async () => {
      const firstEvent = await prisma.action.findFirst({
        where: {
          personId,
          actionClass: {
            id: actionClassId,
          },
        },
        orderBy: {
          createdAt: "asc",
        },
        select: {
          createdAt: true,
        },
      });

      if (!firstEvent) return null;
      return differenceInDays(new Date(), firstEvent.createdAt);
    },
    [`getFirstOccurrenceDaysAgo-${actionClassId}-${personId}`],
    {
      tags: [actionClassCache.tag.byId(actionClassId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();
