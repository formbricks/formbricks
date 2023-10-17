import "server-only";

import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/v1/environment";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/v1/errors";
import { TPerson, TPersonUpdateInput, ZPersonUpdateInput } from "@formbricks/types/v1/people";
import { Prisma } from "@prisma/client";
import { revalidateTag, unstable_cache } from "next/cache";
import { validateInputs } from "../utils/validate";
import { getAttributeClassByName } from "../attributeClass/service";
import { SERVICES_REVALIDATION_INTERVAL, ITEMS_PER_PAGE } from "../constants";
import { ZString, ZOptionalNumber } from "@formbricks/types/v1/common";

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
    createdAt: person.createdAt,
    updatedAt: person.updatedAt,
  } as TPerson;
};

export const getPerson = async (personId: string): Promise<TPerson | null> => {
  validateInputs([personId, ZId]);

  try {
    const person = await prisma.person.findUnique({
      where: {
        id: personId,
      },
      select: selectPerson,
    });

    if (!person) {
      return null;
    }

    return transformPrismaPerson(person);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }

    throw error;
  }
};

const getPersonCacheKey = (personId: string): string[] => [personId];

export const getPersonCached = async (personId: string) =>
  await unstable_cache(
    async () => {
      validateInputs([personId, ZId]);

      return await getPerson(personId);
    },
    getPersonCacheKey(personId),
    {
      tags: getPersonCacheKey(personId),
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

export const getPeople = async (environmentId: string, page?: number): Promise<TPerson[]> => {
  validateInputs([environmentId, ZId], [page, ZOptionalNumber]);

  try {
    const people = await prisma.person.findMany({
      where: {
        environmentId: environmentId,
      },
      select: selectPerson,
      take: page ? ITEMS_PER_PAGE : undefined,
      skip: page ? ITEMS_PER_PAGE * (page - 1) : undefined,
    });

    if (!people || people.length === 0) {
      return [];
    }

    return people
      .map(transformPrismaPerson)
      .filter((person: TPerson | null): person is TPerson => person !== null);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }

    throw error;
  }
};

export const getPeopleCount = async (environmentId: string): Promise<number> => {
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
};

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

    if (transformedPerson) {
      // revalidate person
      revalidateTag(transformedPerson.id);
    }

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

    if (transformedPerson) {
      // revalidate person
      revalidateTag(personId);
    }

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

    return transformPrismaPerson(person);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }

    throw error;
  }
};
export const getOrCreatePersonByUserId = async (userId: string, environmentId: string): Promise<TPerson> => {
  validateInputs([userId, ZString], [environmentId, ZId]);

  // Check if a person with the userId attribute exists
  const person = await prisma.person.findFirst({
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

  if (person) {
    return transformPrismaPerson(person);
  } else {
    // Create a new person with the userId attribute
    const userIdAttributeClass = await getAttributeClassByName(environmentId, "userId");

    if (!userIdAttributeClass) {
      throw new ResourceNotFoundError("Attribute class not found for the given environment", environmentId);
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

    if (person) {
      // revalidate person
      revalidateTag(person.id);
    }

    return transformPrismaPerson(person);
  }
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

  // revalidate person
  revalidateTag(personId);

  return attributes;
};
