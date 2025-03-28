import { contactAttributeCache } from "@/lib/cache/contact-attribute";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { DatabaseError } from "@formbricks/types/errors";

export const getContactAttributes = reactCache((environmentId: string) =>
  cache(
    async () => {
      try {
        const contactAttributeKeys = await prisma.contactAttribute.findMany({
          where: {
            attributeKey: { environmentId },
          },
        });

        return contactAttributeKeys;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw new DatabaseError(error.message);
        }
        throw error;
      }
    },
    [`getContactAttributes-contact-attributes-management-api-${environmentId}`],
    {
      tags: [contactAttributeCache.tag.byEnvironmentId(environmentId)],
    }
  )()
);
