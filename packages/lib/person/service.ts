import "server-only";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { ZOptionalNumber, ZString } from "@formbricks/types/common";
import { ZId } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";
import { TPerson } from "@formbricks/types/people";
import { cache } from "../cache";
import { ITEMS_PER_PAGE } from "../constants";
import { validateInputs } from "../utils/validate";
import { activePersonCache, personCache } from "./cache";

export const selectPerson = {
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  environmentId: true,
};

type TransformPersonInput = {
  id: string;
  userId: string;
  environmentId: string;
  attributes: {
    value: string;
    attributeClass: {
      name: string;
    };
  }[];
  createdAt: Date;
  updatedAt: Date;
};

export const transformPrismaPerson = (person: TransformPersonInput): TPerson => {
  const attributes = person.attributes.reduce(
    (acc, attr) => {
      acc[attr.attributeClass.name] = attr.value;
      return acc;
    },
    {} as Record<string, string | number>
  );

  return {
    id: person.id,
    userId: person.userId,
    attributes: attributes,
    environmentId: person.environmentId,
    createdAt: new Date(person.createdAt),
    updatedAt: new Date(person.updatedAt),
  } as TPerson;
};

export const getPerson = reactCache(
  (personId: string): Promise<TPerson | null> =>
    cache(
      async () => {
        validateInputs([personId, ZId]);

        try {
          return await prisma.person.findUnique({
            where: {
              id: personId,
            },
            select: selectPerson,
          });
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`getPerson-${personId}`],
      {
        tags: [personCache.tag.byId(personId)],
      }
    )()
);

export const getPeople = reactCache(
  (environmentId: string, page?: number): Promise<TPerson[]> =>
    cache(
      async () => {
        validateInputs([environmentId, ZId], [page, ZOptionalNumber]);

        try {
          return await prisma.person.findMany({
            where: {
              environmentId: environmentId,
            },
            select: selectPerson,
            take: page ? ITEMS_PER_PAGE : undefined,
            skip: page ? ITEMS_PER_PAGE * (page - 1) : undefined,
          });
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`getPeople-${environmentId}-${page}`],
      {
        tags: [personCache.tag.byEnvironmentId(environmentId)],
      }
    )()
);

export const getPeopleCount = reactCache(
  (environmentId: string): Promise<number> =>
    cache(
      async () => {
        validateInputs([environmentId, ZId]);

        try {
          return await prisma.person.count({
            where: {
              environmentId: environmentId,
            },
          });
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`getPeopleCount-${environmentId}`],
      {
        tags: [personCache.tag.byEnvironmentId(environmentId)],
      }
    )()
);

export const createPerson = async (environmentId: string, userId: string): Promise<TPerson> => {
  validateInputs([environmentId, ZId]);

  try {
    const person = await prisma.person.create({
      data: {
        environment: {
          connect: {
            id: environmentId,
          },
        },
        userId,
      },
      select: selectPerson,
    });

    personCache.revalidate({
      id: person.id,
      environmentId,
      userId,
    });

    return person;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // If the person already exists, return it
      if (error.code === "P2002") {
        // HOTFIX to handle formbricks-js failing because of caching issue
        // Handle the case where the person record already exists
        const existingPerson = await prisma.person.findFirst({
          where: {
            environmentId,
            userId,
          },
          select: selectPerson,
        });

        if (existingPerson) {
          return existingPerson;
        }
      }
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const deletePerson = async (personId: string): Promise<TPerson | null> => {
  validateInputs([personId, ZId]);

  try {
    const person = await prisma.person.delete({
      where: {
        id: personId,
      },
      select: selectPerson,
    });

    personCache.revalidate({
      id: person.id,
      userId: person.userId,
      environmentId: person.environmentId,
    });

    return person;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const getPersonByUserId = reactCache(
  (environmentId: string, userId: string): Promise<TPerson | null> =>
    cache(
      async () => {
        validateInputs([environmentId, ZId], [userId, ZString]);

        // check if userId exists as a column
        const personWithUserId = await prisma.person.findFirst({
          where: {
            environmentId,
            userId,
          },
          select: selectPerson,
        });

        if (personWithUserId) {
          return personWithUserId;
        }

        return null;
      },
      [`getPersonByUserId-${environmentId}-${userId}`],
      {
        tags: [personCache.tag.byEnvironmentIdAndUserId(environmentId, userId)],
      }
    )()
);

export const getIsPersonMonthlyActive = reactCache(
  (personId: string): Promise<boolean> =>
    cache(
      async () => {
        try {
          const latestAction = await prisma.action.findFirst({
            where: {
              personId,
            },
            orderBy: {
              createdAt: "desc",
            },
            select: {
              createdAt: true,
            },
          });
          if (!latestAction || new Date(latestAction.createdAt).getMonth() !== new Date().getMonth()) {
            return false;
          }
          return true;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`getIsPersonMonthlyActive-${personId}`],
      {
        tags: [activePersonCache.tag.byId(personId)],
        revalidate: 60 * 60 * 24, // 24 hours
      }
    )()
);
