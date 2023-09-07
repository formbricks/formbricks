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
