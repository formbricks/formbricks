import { contactCache } from "@/lib/cache/contact";
import { contactAttributeCache } from "@/lib/cache/contact-attribute";
import { contactAttributeKeyCache } from "@/lib/cache/contact-attribute-key";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";

export const getContactByUserIdWithAttributes = reactCache(
  (environmentId: string, userId: string, updatedAttributes: Record<string, string>) =>
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
              where: {
                attributeKey: {
                  key: {
                    in: Object.keys(updatedAttributes),
                  },
                },
              },
              select: { attributeKey: { select: { key: true } }, value: true },
            },
          },
        });

        if (!contact) {
          return null;
        }

        return contact;
      },
      [`getContactByUserIdWithAttributes-${environmentId}-${userId}-${JSON.stringify(updatedAttributes)}`],
      {
        tags: [
          contactCache.tag.byEnvironmentIdAndUserId(environmentId, userId),
          contactAttributeCache.tag.byEnvironmentIdAndUserId(environmentId, userId),
          contactAttributeKeyCache.tag.byEnvironmentId(environmentId),
        ],
      }
    )()
);
