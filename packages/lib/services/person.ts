import { prisma } from "@formbricks/database";
import { TPerson } from "@formbricks/types/v1/people";
import { Prisma } from "@prisma/client";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/errors";
import { cache } from "react";

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

export type TransformPersonOutput = {
  id: string;
  attributes: Record<string, string | number>;
  createdAt: Date;
  updatedAt: Date;
};

export const transformPrismaPerson = (person: TransformPersonInput | null): TransformPersonOutput | null => {
  if (person === null) {
    return null;
  }

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

export const getPerson = async (personId: string): Promise<TPerson | null> => {
  try {
    const personPrisma = await prisma.person.findUnique({
      where: {
        id: personId,
      },
      include: {
        attributes: {
          include: {
            attributeClass: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!personPrisma) {
      throw new ResourceNotFoundError("Person", personId);
    }

    const person = transformPrismaPerson(personPrisma);

    return person;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }

    throw error;
  }
};

export const getPeople = cache(async (environmentId: string): Promise<TPerson[]> => {
  try {
    const personsPrisma = await prisma.person.findMany({
      where: {
        environmentId: environmentId,
      },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
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
      },
    });
    if (!personsPrisma) {
      throw new ResourceNotFoundError("Persons", "All Persons");
    }

    const transformedPersons: TransformPersonOutput[] = personsPrisma
      .map(transformPrismaPerson)
      .filter((person: TransformPersonOutput | null): person is TransformPersonOutput => person !== null);

    return transformedPersons;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }

    throw error;
  }
});
