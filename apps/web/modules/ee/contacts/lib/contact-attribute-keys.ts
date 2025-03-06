import { contactAttributeKeyCache } from "@/lib/cache/contact-attribute-key";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";

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
