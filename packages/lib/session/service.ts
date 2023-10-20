"use server";
import "server-only";

import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/environment";
import { DatabaseError } from "@formbricks/types/errors";
import { TSession, TSessionWithActions } from "@formbricks/types/sessions";
import { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { validateInputs } from "../utils/validate";
import { ZOptionalNumber } from "@formbricks/types/common";
import { ITEMS_PER_PAGE, SERVICES_REVALIDATION_INTERVAL } from "../constants";
import { sessionCache } from "./cache";
import { formatSessionDateFields } from "./util";

const select = {
  id: true,
  createdAt: true,
  updatedAt: true,
  expiresAt: true,
  personId: true,
};

const oneHour = 1000 * 60 * 60;

export const getSession = async (sessionId: string): Promise<TSession | null> => {
  const session = await unstable_cache(
    async () => {
      validateInputs([sessionId, ZId]);

      try {
        const session = await prisma.session.findUnique({
          where: {
            id: sessionId,
          },
          select,
        });

        return session;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw new DatabaseError(error.message);
        }

        throw error;
      }
    },
    [`getSession-${sessionId}`],
    {
      tags: [sessionCache.tag.byId(sessionId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

  if (!session) return null;

  return formatSessionDateFields(session);
};

export const getSessionWithActionsOfPerson = async (
  personId: string,
  page?: number
): Promise<TSessionWithActions[] | null> =>
  unstable_cache(
    async () => {
      validateInputs([personId, ZId], [page, ZOptionalNumber]);

      try {
        const sessionsWithActionsForPerson = await prisma.session.findMany({
          where: {
            personId,
          },
          select: {
            id: true,
            events: {
              select: {
                id: true,
                createdAt: true,
                eventClass: {
                  select: {
                    name: true,
                    description: true,
                    type: true,
                  },
                },
              },
            },
          },
          take: page ? ITEMS_PER_PAGE : undefined,
          skip: page ? ITEMS_PER_PAGE * (page - 1) : undefined,
        });
        if (!sessionsWithActionsForPerson) return null;

        return sessionsWithActionsForPerson;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw new DatabaseError(error.message);
        }
        throw error;
      }
    },
    [`getSessionWithActionsOfPerson-${personId}-${page}`],
    {
      tags: [sessionCache.tag.byPersonId(personId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

export const getSessionCount = async (personId: string): Promise<number> =>
  unstable_cache(
    async () => {
      validateInputs([personId, ZId]);

      try {
        const sessionCount = await prisma.session.count({
          where: {
            personId,
          },
        });
        return sessionCount;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw new DatabaseError(error.message);
        }
        throw error;
      }
    },
    [`getSessionCount-${personId}`],
    {
      tags: [sessionCache.tag.byPersonId(personId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

export const createSession = async (personId: string): Promise<TSession> => {
  validateInputs([personId, ZId]);
  try {
    const session = await prisma.session.create({
      data: {
        person: {
          connect: {
            id: personId,
          },
        },
        expiresAt: new Date(Date.now() + oneHour),
      },
      select,
    });

    if (session) {
      sessionCache.revalidate({
        id: session.id,
        personId,
      });
    }

    return session;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const extendSession = async (sessionId: string): Promise<TSession> => {
  validateInputs([sessionId, ZId]);

  try {
    const session = await prisma.session.update({
      where: {
        id: sessionId,
      },
      data: {
        expiresAt: new Date(Date.now() + oneHour),
      },
      select,
    });

    // revalidate session cache
    sessionCache.revalidate({
      id: sessionId,
    });

    return session;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};
