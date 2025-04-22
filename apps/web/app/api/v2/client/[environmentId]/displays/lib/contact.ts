import { cache } from "@/lib/cache";
import { contactCache } from "@/lib/cache/contact";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";

export const doesContactExist = reactCache(
  (id: string): Promise<boolean> =>
    cache(
      async () => {
        const contact = await prisma.contact.findFirst({
          where: {
            id,
          },
          select: {
            id: true,
          },
        });

        return !!contact;
      },
      [`doesContactExistDisplaysApiV2-${id}`],
      {
        tags: [contactCache.tag.byId(id)],
      }
    )()
);
