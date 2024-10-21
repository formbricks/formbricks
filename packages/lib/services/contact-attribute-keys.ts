import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-keys";
import { cache } from "../cache";
import { contactAttributeKeyCache } from "../cache/contact-attribute-key";

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
