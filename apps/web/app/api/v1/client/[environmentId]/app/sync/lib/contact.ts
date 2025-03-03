import "server-only";
import { contactCache } from "@/lib/cache/contact";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";

export const getContactByUserId = reactCache(
  (
    environmentId: string,
    userId: string
  ): Promise<{
    attributes: {
      value: string;
      attributeKey: {
        key: string;
      };
    }[];
    id: string;
  } | null> =>
    cache(
      async () => {
        const contact = await prisma.contact.findFirst({
          where: {
            attributes: {
              some: {
                attributeKey: {
                  key: "userId",
                  environmentId,
                },
                value: userId,
              },
            },
          },
          select: {
            id: true,
            attributes: { select: { attributeKey: { select: { key: true } }, value: true } },
          },
        });

        if (!contact) {
          return null;
        }

        return contact;
      },
      [`getContactByUserId-sync-api-${environmentId}-${userId}`],
      {
        tags: [contactCache.tag.byEnvironmentIdAndUserId(environmentId, userId)],
      }
    )()
);
