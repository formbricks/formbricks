import {
  startOfQuarter,
  subQuarters,
  startOfMonth,
  subMonths,
  subWeeks,
  startOfWeek,
  differenceInDays,
} from "date-fns";

import { prisma } from "@formbricks/database";

import { DatabaseError } from "@formbricks/errors";
import { TAction } from "@formbricks/types/v1/actions";
import { Prisma } from "@prisma/client";
import { cache } from "react";
import "server-only";

export const getStartDateOfLastQuarter = () => {
  return startOfQuarter(subQuarters(new Date(), 1));
};

export const getStartDateOfLastMonth = () => {
  return startOfMonth(subMonths(new Date(), 1));
};

export const getStartDateOfLastWeek = () => {
  return startOfWeek(subWeeks(new Date(), 1));
};

export const getLastQuarterEventCount = async (
  environmentId: string,
  personId: string,
  eventClassId: string
): Promise<number> => {
  return await prisma.event.count({
    where: {
      session: {
        personId,
      },
      eventClass: {
        id: eventClassId,
        environmentId,
      },
      createdAt: {
        gte: getStartDateOfLastQuarter(),
      },
    },
  });
};

export const getLastMonthEventCount = async (
  environmentId: string,
  personId: string,
  eventClassId: string
): Promise<number> => {
  return await prisma.event.count({
    where: {
      session: {
        personId,
      },
      eventClass: {
        id: eventClassId,
        environmentId,
      },
      createdAt: {
        gte: getStartDateOfLastMonth(),
      },
    },
  });
};

export const getLastWeekEventCount = async (
  environmentId: string,
  personId: string,
  eventClassId: string
): Promise<number> => {
  return await prisma.event.count({
    where: {
      session: {
        personId,
      },
      eventClass: {
        id: eventClassId,
        environmentId,
      },
      createdAt: {
        gte: getStartDateOfLastWeek(),
      },
    },
  });
};

export const getTotalOccurrences = async (
  environmentId: string,
  personId: string,
  eventClassId: string
): Promise<number> => {
  return await prisma.event.count({
    where: {
      session: {
        personId,
      },
      eventClass: {
        id: eventClassId,
        environmentId,
      },
    },
  });
};

export const getLastOccurrenceDaysAgo = async (
  environmentId: string,
  personId: string,
  eventClassId: string
): Promise<number | null> => {
  const lastEvent = await prisma.event.findFirst({
    where: {
      session: {
        personId,
      },
      eventClass: {
        id: eventClassId,
        environmentId,
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
};

export const getFirstOccurrenceDaysAgo = async (
  environmentId: string,
  personId: string,
  eventClassId: string
): Promise<number | null> => {
  const firstEvent = await prisma.event.findFirst({
    where: {
      session: {
        personId,
      },
      eventClass: {
        id: eventClassId,
        environmentId,
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
};

export const getActionsByEnvironmentId = cache(
  async (environmentId: string, limit?: number): Promise<TAction[]> => {
    try {
      const actionsPrisma = await prisma.event.findMany({
        where: {
          eventClass: {
            environmentId: environmentId,
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: limit ? limit : 20,
        include: {
          eventClass: true,
        },
      });
      const actions: TAction[] = [];
      // transforming response to type TAction[]
      actionsPrisma.forEach((action) => {
        actions.push({
          id: action.id,
          createdAt: action.createdAt,
          sessionId: action.sessionId,
          properties: action.properties,
          actionClass: action.eventClass,
        });
      });
      return actions;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError("Database operation failed");
      }

      throw error;
    }
  }
);
