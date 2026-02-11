import "server-only";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database/src/client";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { DatabaseError } from "@formbricks/types/errors";

/**
 * Get contact attributes for a specific contact
 * Returns a map of attribute key names to values
 */
export const getContactAttributesByContactId = reactCache(
  async (contactId: string): Promise<Record<string, string>> => {
    try {
      const contactAttributes = await prisma.contactAttribute.findMany({
        where: {
          contactId,
        },
        include: {
          attributeKey: {
            select: {
              name: true,
            },
          },
        },
      });

      // Convert to a map of attribute key name -> value
      const attributesMap: Record<string, string> = {};
      for (const attr of contactAttributes) {
        if (attr.attributeKey?.name) {
          attributesMap[attr.attributeKey.name] = attr.value;
        }
      }

      return attributesMap;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        console.error(error);
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);

/**
 * Get contact by userId in an environment
 */
export const getContactByUserId = reactCache(async (environmentId: string, userId: string) => {
  try {
    const contact = await prisma.contact.findUnique({
      where: {
        environmentId_userId: {
          environmentId,
          userId,
        },
      },
    });

    return contact;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error(error);
      throw new DatabaseError(error.message);
    }
    throw error;
  }
});

/**
 * Get all attribute keys for an environment
 */
export const getContactAttributeKeysByEnvironmentId = reactCache(
  async (environmentId: string): Promise<TContactAttributeKey[]> => {
    try {
      const attributeKeys = await prisma.contactAttributeKey.findMany({
        where: {
          environmentId,
        },
        orderBy: {
          name: "asc",
        },
      });

      return attributeKeys;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        console.error(error);
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);
