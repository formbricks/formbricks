import "server-only";

import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/v1/environment";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/v1/errors";
import { TPerson, TPersonUpdateInput } from "@formbricks/types/v1/people";
import { Prisma } from "@prisma/client";
import { revalidateTag, unstable_cache } from "next/cache";
import { cache } from "react";
import { PEOPLE_PER_PAGE } from "../constants";
import { validateInputs } from "../utils/validate";
import { getAttributeClassByName } from "../attributeClass/service";
import { SERVICES_REVALIDATION_INTERVAL } from "../constants";

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
  const attributes = person.attributes.reduce(
    (acc, attr) => {
      acc[attr.attributeClass.name] = attr.value;
      return acc;
    },
    {} as Record<string, string | number>
  );

  return {
    id: person.id,
    attributes: attributes,
    environmentId: person.environmentId,
    createdAt: person.createdAt,
    updatedAt: person.updatedAt,
  };
};

export const getPerson = cache(async (personId: string): Promise<TPerson | null> => {
  validateInputs([personId, ZId]);
  try {
    const personPrisma = await prisma.person.findUnique({
      where: {
        id: personId,
      },
      select: selectPerson,
    });

    if (!personPrisma) {
      return null;
    }

    const person = transformPrismaPerson(personPrisma);

    return person;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }

    throw error;
  }
});

const getPersonCacheKey = (personId: string): string[] => [personId];

export const getPersonCached = async (personId: string) =>
  await unstable_cache(
    async () => {
      return await getPerson(personId);
    },
    getPersonCacheKey(personId),
    {
      tags: getPersonCacheKey(personId),
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

export const getPeople = cache(async (environmentId: string, page: number = 1): Promise<TPerson[]> => {
  validateInputs([environmentId, ZId]);
  try {
    const itemsPerPage = PEOPLE_PER_PAGE;
    const people = await prisma.person.findMany({
      where: {
        environmentId: environmentId,
      },
      select: selectPerson,
      take: itemsPerPage,
      skip: itemsPerPage * (page - 1),
    });

    if (!people || people.length === 0) {
      return [];
    }

    const transformedPeople: TPerson[] = people
      .map(transformPrismaPerson)
      .filter((person: TPerson | null): person is TPerson => person !== null);

    return transformedPeople;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }

    throw error;
  }
});

export const getPeopleCount = cache(async (environmentId: string): Promise<number> => {
  validateInputs([environmentId, ZId]);
  try {
    const totalCount = await prisma.person.count({
      where: {
        environmentId: environmentId,
      },
    });
    return totalCount;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
});

export const createPerson = async (environmentId: string): Promise<TPerson> => {
  validateInputs([environmentId, ZId]);
  try {
    const personPrisma = await prisma.person.create({
      data: {
        environment: {
          connect: {
            id: environmentId,
          },
        },
      },
      select: selectPerson,
    });

    const person = transformPrismaPerson(personPrisma);

    if (person) {
      // revalidate person
      revalidateTag(person.id);
    }

    return person;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const deletePerson = async (personId: string): Promise<void> => {
  validateInputs([personId, ZId]);
  try {
    await prisma.person.delete({
      where: {
        id: personId,
      },
    });

    // revalidate person
    revalidateTag(personId);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }

    throw error;
  }
};

export const updatePerson = async (personId: string, personInput: TPersonUpdateInput): Promise<TPerson> => {
  try {
    const personPrisma = await prisma.person.update({
      where: {
        id: personId,
      },
      data: personInput,
      select: selectPerson,
    });

    const person = transformPrismaPerson(personPrisma);
    return person;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }

    throw error;
  }
};
export const getOrCreatePersonByUserId = async (userId: string, environmentId: string): Promise<TPerson> => {
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
    const person = transformPrismaPerson(personPrisma);
    return person;
  } else {
    // Create a new person with the userId attribute
    const userIdAttributeClass = await getAttributeClassByName(environmentId, "userId");

    if (!userIdAttributeClass) {
      throw new ResourceNotFoundError("Attribute class not found for the given environment", environmentId);
    }

    const personPrisma = await prisma.person.create({
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

    if (personPrisma) {
      // revalidate person
      revalidateTag(personPrisma.id);
    }

    return transformPrismaPerson(personPrisma);
  }
};

export const getMonthlyActivePeopleCount = async (environmentId: string): Promise<number> =>
  await unstable_cache(
    async () => {
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const aggregations = await prisma.person.aggregate({
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

      return aggregations._count.id;
    },
    [`environments-${environmentId}-mau`],
    {
      tags: [`environments-${environmentId}-mau`],
      revalidate: 60 * 60 * 6, // 6 hours
    }
  )();

export const updatePersonAttribute = async (
  personId: string,
  attributeClassId: string,
  value: string
): Promise<void> => {
  await prisma.attribute.upsert({
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

  // revalidate person
  revalidateTag(personId);
};
