import "server-only";

import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/v1/environment";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/v1/errors";
import { TPerson, TPersonUpdateInput, ZPersonUpdateInput } from "@formbricks/types/v1/people";
import { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { validateInputs } from "../utils/validate";
import { getAttributeClassByName } from "../attributeClass/service";
import { SERVICES_REVALIDATION_INTERVAL, ITEMS_PER_PAGE } from "../constants";
import { ZString, ZOptionalNumber } from "@formbricks/types/v1/common";
import { personCache } from "./cache";

export const selectPerson = {
  id: true,
  createdAt: true,
  updatedAt: true,
  environmentId: true,
  attributes: {
    where: {
      attributeClass: {
        archived: false,
      },
    },
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
  const attributes = person.attributes.reduce((acc, attr) => {
    acc[attr.attributeClass.name] = attr.value;
    return acc;
  }, {} as Record<string, string | number>);

  return {
    id: person.id,
    attributes: attributes,
    environmentId: person.environmentId,
    createdAt: new Date(person.createdAt),
    updatedAt: new Date(person.updatedAt),
  } as TPerson;
};

export const getPerson = async (personId: string): Promise<TPerson | null> => {
  const prismaPerson = await unstable_cache(
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
          throw new DatabaseError("Database operation failed");
        }

        throw error;
      }
    },
    [`getPerson-${personId}`],
    { tags: [personCache.tag.byId(personId)], revalidate: SERVICES_REVALIDATION_INTERVAL }
  )();

  if (!prismaPerson) {
    return null;
  }

  return transformPrismaPerson(prismaPerson);
};

export const getPeople = async (environmentId: string, page?: number): Promise<TPerson[]> => {
  const peoplePrisma = await unstable_cache(
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
          throw new DatabaseError("Database operation failed");
        }

        throw error;
      }
    },
    [`getPeople-${environmentId}-${page}`],
    {
      tags: [personCache.tag.byEnvironmentId(environmentId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

  if (!peoplePrisma || peoplePrisma.length === 0) {
    return [];
  }

  return peoplePrisma
    .map(transformPrismaPerson)
    .filter((person: TPerson | null): person is TPerson => person !== null);
};

export const getPeopleCount = async (environmentId: string): Promise<number> =>
  unstable_cache(
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
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

export const createPerson = async (environmentId: string): Promise<TPerson> => {
  validateInputs([environmentId, ZId]);

  try {
    const person = await prisma.person.create({
      data: {
        environment: {
          connect: {
            id: environmentId,
          },
        },
      },
      select: selectPerson,
    });

    const transformedPerson = transformPrismaPerson(person);

    personCache.revalidate({
      id: transformedPerson.id,
      environmentId: transformedPerson.environmentId,
    });

    return transformedPerson;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
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
    const transformedPerson = transformPrismaPerson(person);

    personCache.revalidate({
      id: transformedPerson.id,
      environmentId: transformedPerson.environmentId,
    });

    return transformedPerson;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }

    throw error;
  }
};

export const updatePerson = async (personId: string, personInput: TPersonUpdateInput): Promise<TPerson> => {
  validateInputs([personId, ZId], [personInput, ZPersonUpdateInput]);

  try {
    const person = await prisma.person.update({
      where: {
        id: personId,
      },
      data: personInput,
      select: selectPerson,
    });

    personCache.revalidate({
      id: personId,
      environmentId: person.environmentId,
    });

    return transformPrismaPerson(person);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }

    throw error;
  }
};

export const getOrCreatePersonByUserId = async (userId: string, environmentId: string): Promise<TPerson> => {
  const personPrisma = await unstable_cache(
    async () => {
      validateInputs([userId, ZString], [environmentId, ZId]);

      // Check if a person with the userId attribute exists
      const personPrisma = await prisma.person.findFirst({
        where: {
          environmentId,
          attributes: {
            some: {
              attributeClass: {
                name: "userId",
              },
              value: userId,
            },
          },
        },
        select: selectPerson,
      });

      if (personPrisma) {
        return personPrisma;
      } else {
        // Create a new person with the userId attribute
        const userIdAttributeClass = await getAttributeClassByName(environmentId, "userId");

        if (!userIdAttributeClass) {
          throw new ResourceNotFoundError(
            "Attribute class not found for the given environment",
            environmentId
          );
        }

        const person = await prisma.person.create({
          data: {
            environment: {
              connect: {
                id: environmentId,
              },
            },
            attributes: {
              create: [
                {
                  attributeClass: {
                    connect: {
                      id: userIdAttributeClass.id,
                    },
                  },
                  value: userId,
                },
              ],
            },
          },
          select: selectPerson,
        });

        personCache.revalidate({
          id: person.id,
          environmentId: person.environmentId,
          userId,
        });

        return person;
      }
    },
    [`getOrCreatePersonByUserId-${userId}-${environmentId}`],
    {
      tags: [personCache.tag.byUserIdAndEnvironmentId(userId, environmentId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

  return transformPrismaPerson(personPrisma);
};

export const getMonthlyActivePeopleCount = async (environmentId: string): Promise<number> =>
  await unstable_cache(
    async () => {
      validateInputs([environmentId, ZId]);

      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const personAggregations = await prisma.person.aggregate({
        _count: {
          id: true,
        },
        where: {
          environmentId,
          sessions: {
            some: {
              createdAt: {
                gte: firstDayOfMonth,
              },
            },
          },
        },
      });

      return personAggregations._count.id;
    },
    [`getMonthlyActivePeopleCount-${environmentId}`],
    {
      tags: [personCache.tag.byEnvironmentId(environmentId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

export const updatePersonAttribute = async (
  personId: string,
  attributeClassId: string,
  value: string
): Promise<Partial<TPerson>> => {
  validateInputs([personId, ZId], [attributeClassId, ZId], [value, ZString]);

  const attributes = await prisma.attribute.upsert({
    where: {
      attributeClassId_personId: {
        attributeClassId,
        personId,
      },
    },
    update: {
      value,
    },
    create: {
      attributeClass: {
        connect: {
          id: attributeClassId,
        },
      },
      person: {
        connect: {
          id: personId,
        },
      },
      value,
    },
  });

  personCache.revalidate({
    id: personId,
  });

  return attributes;
};
