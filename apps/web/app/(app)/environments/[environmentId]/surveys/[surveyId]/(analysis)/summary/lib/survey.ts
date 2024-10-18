import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { contactAttributeKeyCache } from "@formbricks/lib/cache/contact-attribute-key";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-keys";

export const getContactAttributeKeys = reactCache(
  (environmentId: string): Promise<TContactAttributeKey[]> =>
    cache(
      async () => {
        return await prisma.contactAttributeKey.findMany({
          where: { environmentId },
        });
      },
      [`getContactAttributeKeys-${environmentId}`],
      {
        tags: [contactAttributeKeyCache.tag.byEnvironmentId(environmentId)],
      }
    )()
);
