"use server";
import "server-only";

import { prisma } from "@formbricks/database";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/errors";
import {
  TPerson,
  TPersonDetailedAttribute,
  TPersonWithDetailedAttributes,
  selectPersonSchemaFromPrisma,
} from "@formbricks/types/v1/people";
import { Prisma } from "@prisma/client";
import { cache } from "react";

const detailedAttributeSelect = {
  id: true,
  createdAt: true,
  updatedAt: true,
  attributes: {
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      value: true,
      attributeClass: {
        select: {
          name: true,
          archived: true,
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

export const getPerson = async (personId: string): Promise<TPerson | null> => {
  try {
    const personPrisma = await prisma.person.findUnique({
      where: {
        id: personId,
      },
      select: selectPersonSchemaFromPrisma,
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
};

export const getPersonWithAttributeClasses = cache(
  async (personId: string): Promise<TPersonWithDetailedAttributes | null> => {
    try {
      const personPrisma = await prisma.person.findUnique({
        where: {
          id: personId,
        },
        select: detailedAttributeSelect,
      });
      if (!personPrisma) {
        return null;
      }

      let attributes: Array<TPersonDetailedAttribute> = [];
      personPrisma.attributes.forEach((attr) => {
        if (!attr.attributeClass.archived) {
          attributes.push({
            id: attr.id,
            name: attr.attributeClass.name,
            value: attr.value,
            createdAt: attr.createdAt,
            updatedAt: attr.updatedAt,
            archived: attr.attributeClass.archived,
          });
        }
      });

      return {
        id: personPrisma.id,
        attributes: attributes,
        createdAt: personPrisma.createdAt,
        updatedAt: personPrisma.updatedAt,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError("Database operation failed");
      }

      throw error;
    }
  }
);

export const getPeople = cache(async (environmentId: string): Promise<TPerson[]> => {
  try {
    const personsPrisma = await prisma.person.findMany({
      where: {
        environmentId: environmentId,
      },
      select: selectPersonSchemaFromPrisma,
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
  try {
    const personPrisma = await prisma.person.create({
      data: {
        environment: {
          connect: {
            id: environmentId,
          },
        },
      },
      select: selectPersonSchemaFromPrisma,
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
