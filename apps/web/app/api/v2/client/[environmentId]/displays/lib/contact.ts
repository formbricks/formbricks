import { contactCache } from "@/lib/cache/contact";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";

export const getContact = reactCache(
  (
    id: string
  ): Promise<{
    id: string;
  } | null> =>
    cache(
      async () => {
        const contact = await prisma.contact.findFirst({
          where: {
            id,
          },
          select: { id: true },
        });

        if (!contact) {
          return null;
        }

        return contact;
      },
      [`getContactDisplaysApiV2-${id}`],
      {
        tags: [contactCache.tag.byId(id)],
      }
    )()
);
