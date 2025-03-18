import { contactCache } from "@/lib/cache/contact";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";

export const getContact = reactCache(async (contactId: string, environmentId: string) =>
  cache(
    async () => {
      const contact = await prisma.contact.findUnique({
        where: {
          id: contactId,
          environmentId,
        },
        select: {
          id: true,
        },
      });

      if (!contact) {
        return null;
      }

      return contact;
    },
    [`contact-link-getContact-${contactId}-${environmentId}`],
    {
      tags: [contactCache.tag.byId(contactId), contactCache.tag.byEnvironmentId(environmentId)],
    }
  )()
);
