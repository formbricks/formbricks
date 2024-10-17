import "server-only";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { ITEMS_PER_PAGE } from "@formbricks/lib/constants";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { ZId, ZOptionalNumber, ZOptionalString } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";
import { TContact, TContactWithAttributes } from "../types/contact";
import { contactCache } from "./contactCache";

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
        },
      },
    },
  },
} satisfies Prisma.ContactSelect;

export const selectAttribute = {
  value: true,
  attributeKey: {
    select: {
      key: true,
      name: true,
    },
  },
} satisfies Prisma.ContactAttributeSelect;

// convert prisma attributes to a key-value object
const convertPrismaAttributes = (
  prismaAttributes: any
): {
  [x: string]: {
    name: string | null;
    value: string;
  };
} => {
  return prismaAttributes.reduce(
    (acc, attr) => {
      acc[attr.attributeKey.key] = {
        name: attr.attributeKey.name,
        value: attr.value,
      };
      return acc;
    },
    {} as Record<string, string | number>
  );
};

type TransformPersonInput = {
  id: string;
  environmentId: string;
  attributes: {
    value: string;
    attributeKey: {
      key: string;
      name: string | null;
    };
  }[];
  createdAt: Date;
  updatedAt: Date;
};

export const transformPrismaContact = (person: TransformPersonInput): TContactWithAttributes => {
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
  } as TContactWithAttributes;
};

const buildContactWhereClause = (environmentId: string, search?: string): Prisma.ContactWhereInput => ({
  environmentId,
  OR: [
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

export const getContacts = reactCache(
  (environmentId: string, offset?: number, searchValue?: string): Promise<TContactWithAttributes[]> =>
    cache(
      async () => {
        validateInputs([environmentId, ZId], [offset, ZOptionalNumber], [searchValue, ZOptionalString]);

        try {
          const contacts = await prisma.contact.findMany({
            where: buildContactWhereClause(environmentId, searchValue),
            select: selectContact,
            take: ITEMS_PER_PAGE,
            skip: offset,
          });

          return contacts.map((contact) => transformPrismaContact(contact));
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`getContacts-${environmentId}-${offset}-${searchValue ?? ""}`],
      {
        tags: [contactCache.tag.byEnvironmentId(environmentId)],
      }
    )()
);

export const getContact = reactCache(
  (contactId: string): Promise<TContact | null> =>
    cache(
      async () => {
        validateInputs([contactId, ZId]);

        try {
          return await prisma.contact.findUnique({
            where: {
              id: contactId,
            },
            select: selectContact,
          });
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`getContact-${contactId}`],
      {
        tags: [contactCache.tag.byId(contactId)],
      }
    )()
);

export const getContactAttributeKeys = reactCache((environmentId: string) =>
  cache(
    async () => {
      return await prisma.contactAttributeKey.findMany({
        where: { environmentId },
      });
    },
    [],
    {}
  )()
);

export const getContactAttributes = reactCache((contactId: string) =>
  cache(
    async () => {
      validateInputs([contactId, ZId]);

      try {
        const prismaAttributes = await prisma.contactAttribute.findMany({
          where: {
            contactId,
          },
          select: selectAttribute,
        });

        return convertPrismaAttributes(prismaAttributes);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw new DatabaseError(error.message);
        }

        throw error;
      }
    },
    [],
    {}
  )()
);
