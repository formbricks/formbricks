import { cache } from "@/lib/cache";
import { contactCache } from "@/lib/cache/contact";
import { contactAttributeCache } from "@/lib/cache/contact-attribute";
import { contactAttributeKeyCache } from "@/lib/cache/contact-attribute-key";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";

export const getContactByUserIdWithAttributes = reactCache((environmentId: string, userId: string) =>
  cache(
    async () => {
      const contact = await prisma.contact.findFirst({
        where: {
          environmentId,
          attributes: { some: { attributeKey: { key: "userId", environmentId }, value: userId } },
        },
        select: {
          id: true,
          attributes: {
            select: { attributeKey: { select: { key: true } }, value: true },
          },
        },
      });

      if (!contact) {
        return null;
      }

      return contact;
    },
    [`getContactByUserIdWithAttributes-${environmentId}-${userId}`],
    {
      tags: [
        contactCache.tag.byEnvironmentIdAndUserId(environmentId, userId),
        contactAttributeCache.tag.byEnvironmentIdAndUserId(environmentId, userId),
        contactAttributeKeyCache.tag.byEnvironmentId(environmentId),
      ],
    }
  )()
);
