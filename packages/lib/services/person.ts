import "server-only";

import { prisma } from "@formbricks/database";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/v1/errors";
import { TPerson } from "@formbricks/types/v1/people";
import { Prisma } from "@prisma/client";
import { cache } from "react";
import { validateInputs } from "../utils/validate";
import { ZId } from "@formbricks/types/v1/environment";
import { getAttributeClassByName } from "./attributeClass";

export const selectPerson = {
  id: true,
  createdAt: true,
  updatedAt: true,
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

export const getPeople = cache(async (environmentId: string): Promise<TPerson[]> => {
  validateInputs([environmentId, ZId]);
  try {
    const personsPrisma = await prisma.person.findMany({
      where: {
        environmentId: environmentId,
      },
      select: selectPerson,
    });
    if (!personsPrisma) {
      throw new ResourceNotFoundError("Persons", "All Persons");
    }

    const transformedPeople: TPerson[] = personsPrisma
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
      throw new Error("Attribute class not found for the given environmentId");
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
    return transformPrismaPerson(personPrisma);
  }
};
