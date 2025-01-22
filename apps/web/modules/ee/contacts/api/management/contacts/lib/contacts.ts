import { contactCache } from "@/lib/cache/contact";
import { TContact } from "@/modules/ee/contacts/types/contact";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { ZId } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";

export const getContacts = reactCache(
  (environmentId: string): Promise<TContact[]> =>
    cache(
      async () => {
        validateInputs([environmentId, ZId]);

        try {
          const contacts = await prisma.contact.findMany({
            where: { environmentId },
          });

          return contacts;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`getContacts-management-api-${environmentId}`],
      {
        tags: [contactCache.tag.byEnvironmentId(environmentId)],
      }
    )()
);
