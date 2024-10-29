import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";
import { TPerson, TPersonWithAttributes } from "@formbricks/types/people";
import { validateInputs } from "../utils/validate";
import { personCache } from "./cache";

export const selectContact = {
  id: true,
  createdAt: true,
  updatedAt: true,
  environmentId: true,
  attributes: {
    select: {
      value: true,
      attributeKey: {
        select: {
          key: true,
          name: true,
          description: true,
        },
      },
    },
  },
} satisfies Prisma.ContactSelect;

type TransformPersonInput = {
  id: string;
  environmentId: string;
  attributes: {
    value: string;
    attributeKey: {
      key: string;
      name: string | null;
      description: string | null;
    };
  }[];
  createdAt: Date;
  updatedAt: Date;
};

export const transformPrismaPerson = (person: TransformPersonInput): TPersonWithAttributes => {
  const attributes = person.attributes.reduce(
    (acc, attr) => {
      acc[attr.attributeKey.key] = attr.value;
      return acc;
    },
    {} as Record<string, string | number>
  );

  return {
    id: person.id,
    attributes,
    environmentId: person.environmentId,
    createdAt: new Date(person.createdAt),
    updatedAt: new Date(person.updatedAt),
  } as TPersonWithAttributes;
};

export const deletePerson = async (personId: string): Promise<TPerson | null> => {
  validateInputs([personId, ZId]);

  try {
    const person = await prisma.person.delete({
      where: {
        id: personId,
      },
      select: selectContact,
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
