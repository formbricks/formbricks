import "server-only";
import { cache } from "@/lib/cache";
import { contactCache } from "@/lib/cache/contact";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";

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
    // [UseTusk]

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
