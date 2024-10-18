import "server-only";
import {
  convertPrismaContactAttributes,
  transformPrismaContact,
} from "@/app/(ee)/(contacts)/environments/[environmentId]/contacts/lib/utils";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { ITEMS_PER_PAGE } from "@formbricks/lib/constants";
import { contactAttributeCache } from "@formbricks/lib/contactAttribute/cache";
import { getOrganizationIdFromEnvironmentId } from "@formbricks/lib/organization/utils";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { ZId, ZOptionalNumber, ZOptionalString } from "@formbricks/types/common";
import { TContactAttributes } from "@formbricks/types/contact-attributes";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TContact, TContactWithAttributes } from "../types/contact";
import { contactCache } from "./contactCache";

const selectContact = {
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

const selectContactAttribute = {
  value: true,
  attributeKey: {
    select: {
      key: true,
      name: true,
    },
  },
} satisfies Prisma.ContactAttributeSelect;

const buildContactWhereClause = (environmentId: string, search?: string): Prisma.ContactWhereInput => {
  const whereClause: Prisma.ContactWhereInput = { environmentId };

  if (search) {
    whereClause.OR = [
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
    ];
  }

  return whereClause;
};

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

export const deleteContact = async (contactId: string): Promise<TContact | null> => {
  validateInputs([contactId, ZId]);

  try {
    const contact = await prisma.contact.delete({
      where: {
        id: contactId,
      },
      select: selectContact,
    });

    const userId = contact.attributes.find((attr) => attr.attributeKey.key === "userId")?.value;

    contactCache.revalidate({
      id: contact.id,
      userId,
      environmentId: contact.environmentId,
    });

    return contact;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const getOrganizationIdFromContactId = async (contactId: string) => {
  const contact = await getContact(contactId);
  if (!contact) {
    throw new ResourceNotFoundError("contact", contactId);
  }

  return await getOrganizationIdFromEnvironmentId(contact.environmentId);
};

export const getContactAttributes = reactCache(
  (contactId: string): Promise<TContactAttributes> =>
    cache(
      async () => {
        validateInputs([contactId, ZId]);

        try {
          const prismaAttributes = await prisma.contactAttribute.findMany({
            where: {
              contactId,
            },
            select: selectContactAttribute,
          });

          return convertPrismaContactAttributes(prismaAttributes);
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`getContactAttributes-${contactId}`],
      {
        tags: [contactAttributeCache.tag.byContactId(contactId)],
      }
    )()
);
