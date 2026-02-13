import "server-only";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
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
