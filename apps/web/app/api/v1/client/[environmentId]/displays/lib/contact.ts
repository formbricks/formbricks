import { contactCache } from "@/lib/cache/contact";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";

export const getContactByUserId = reactCache(
  (
    environmentId: string,
    userId: string
  ): Promise<{
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
          select: { id: true },
        });

        if (!contact) {
          return null;
        }

        return contact;
      },
      [`getContactByUserIdForDisplaysApi-${environmentId}-${userId}`],
      {
        tags: [contactCache.tag.byEnvironmentIdAndUserId(environmentId, userId)],
      }
    )()
);
