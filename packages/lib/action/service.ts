import "server-only";

import z from "zod";
import { prisma } from "@formbricks/database";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/v1/errors";
import { TAction } from "@formbricks/types/v1/actions";
import { ZId } from "@formbricks/types/v1/environment";
import { Prisma } from "@prisma/client";
import { cache } from "react";
import { validateInputs } from "../utils/validate";
import { TJsActionInput } from "@formbricks/types/v1/js";
import { revalidateTag } from "next/cache";
import { EventType } from "@prisma/client";
import { getActionClassCacheTag, getActionClassCached } from "../actionClass/service";
import { getSessionCached } from "../session/service";

export const getActionsByEnvironmentId = cache(
  async (environmentId: string, limit?: number): Promise<TAction[]> => {
    validateInputs([environmentId, ZId], [limit, z.number().optional()]);
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

export const createAction = async (data: TJsActionInput) => {
  const { environmentId, name, properties, sessionId } = data;

  let eventType: EventType = EventType.code;
  if (name === "Exit Intent (Desktop)" || name === "50% Scroll") {
    eventType = EventType.automatic;
  }

  const session = await getSessionCached(sessionId);

  if (!session) {
    throw new ResourceNotFoundError("Session", sessionId);
  }

  const actionClass = await getActionClassCached(name, environmentId);

  if (actionClass) {
    await prisma.event.create({
      data: {
        properties,
        sessionId: session.id,
        eventClassId: actionClass.id,
      },
    });

    return;
  }

  // if action class does not exist, create it and then create the action
  await prisma.$transaction([
    prisma.eventClass.create({
      data: {
        name,
        type: eventType,
        environmentId,
      },
    }),

    prisma.event.create({
      data: {
        properties,
        session: {
          connect: {
            id: sessionId,
          },
        },
        eventClass: {
          connectOrCreate: {
            where: {
              name_environmentId: {
                name,
                environmentId,
              },
            },
            create: {
              name,
              type: eventType,
              environment: {
                connect: {
                  id: environmentId,
                },
              },
            },
          },
        },
      },
      select: {
        id: true,
      },
    }),
  ]);

  // revalidate cache
  revalidateTag(sessionId);
  revalidateTag(getActionClassCacheTag(name, environmentId));
};

export const getActionCountInLastHour = cache(async (actionClassId: string) => {
  try {
    const numEventsLastHour = await prisma.event.count({
      where: {
        eventClassId: actionClassId,
        createdAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000),
        },
      },
    });
    return numEventsLastHour;
  } catch (error) {
    throw error;
  }
});

export const getActionCountInLast24Hours = cache(async (actionClassId: string) => {
  try {
    const numEventsLast24Hours = await prisma.event.count({
      where: {
        eventClassId: actionClassId,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    });
    return numEventsLast24Hours;
  } catch (error) {
    throw error;
  }
});

export const getActionCountInLast7Days = cache(async (actionClassId: string) => {
  try {
    const numEventsLast7Days = await prisma.event.count({
      where: {
        eventClassId: actionClassId,
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
    });
    return numEventsLast7Days;
  } catch (error) {
    throw error;
  }
});
