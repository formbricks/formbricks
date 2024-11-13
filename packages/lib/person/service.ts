import "server-only";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { responseCache } from "response/cache";
import { surveyCache } from "survey/cache";
import { prisma } from "@formbricks/database";
import { ZOptionalNumber, ZOptionalString, ZString } from "@formbricks/types/common";
import { ZId } from "@formbricks/types/common";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TPerson, TPersonWithAttributes } from "@formbricks/types/people";
import { cache } from "../cache";
import { ITEMS_PER_PAGE } from "../constants";
import { validateInputs } from "../utils/validate";
import { personCache } from "./cache";

export const selectPerson = {
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  environmentId: true,
  attributes: {
    select: {
      value: true,
      attributeClass: {
        select: {
          name: true,
        },
      },
    },
  },
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

export const transformPrismaPerson = (person: TransformPersonInput): TPersonWithAttributes => {
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
  } as TPersonWithAttributes;
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

const buildPersonWhereClause = (environmentId: string, search?: string): Prisma.PersonWhereInput => ({
  environmentId: environmentId,
  OR: [
    {
      userId: {
        contains: search,
        mode: "insensitive",
      },
    },
    {
      attributes: {
        some: {
          value: {
            contains: search,
            mode: "insensitive",
          },
        },
      },
    },
    {
      id: {
        contains: search,
        mode: "insensitive",
      },
    },
  ],
});

export const getPeople = reactCache(
  (environmentId: string, offset?: number, searchValue?: string): Promise<TPersonWithAttributes[]> =>
    cache(
      async () => {
        validateInputs([environmentId, ZId], [offset, ZOptionalNumber], [searchValue, ZOptionalString]);
        try {
          const persons = await prisma.person.findMany({
            where: buildPersonWhereClause(environmentId, searchValue),
            select: selectPerson,
            take: ITEMS_PER_PAGE,
            skip: offset,
          });

          return persons.map((person) => transformPrismaPerson(person));
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`getPeople-${environmentId}-${offset}-${searchValue ?? ""}`],
      {
        tags: [personCache.tag.byEnvironmentId(environmentId)],
      }
    )()
);

export const getPersonCount = reactCache(
  (environmentId: string, searchValue?: string): Promise<number> =>
    cache(
      async () => {
        validateInputs([environmentId, ZId], [searchValue, ZOptionalString]);

        try {
          return await prisma.person.count({
            where: buildPersonWhereClause(environmentId, searchValue),
          });
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`getPersonCount-${environmentId}-${searchValue ?? ""}`],
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
    const personRespondedSurveyIds = await prisma.response.findMany({
      where: {
        personId,
      },
      select: {
        surveyId: true,
      },
    });

    const uniqueSurveyIds = Array.from(
      new Set(personRespondedSurveyIds.map((response) => response.surveyId))
    );

    const deletedPerson = await prisma.person.delete({
      where: {
        id: personId,
      },
      select: selectPerson,
    });

    personCache.revalidate({
      id: deletedPerson.id,
      userId: deletedPerson.userId,
      environmentId: deletedPerson.environmentId,
    });

    surveyCache.revalidate({
      environmentId: deletedPerson.environmentId,
    });

    responseCache.revalidate({
      personId: deletedPerson.id,
      environmentId: deletedPerson.environmentId,
    });

    for (const surveyId of uniqueSurveyIds) {
      responseCache.revalidate({
        surveyId,
      });
    }

    return deletedPerson;
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

        const environment = await prisma.environment.findUnique({
          where: {
            id: environmentId,
          },
        });

        if (!environment) {
          throw new ResourceNotFoundError("environment", environmentId);
        }

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
