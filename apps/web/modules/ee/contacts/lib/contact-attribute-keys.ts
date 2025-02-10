import { contactAttributeCache } from "@/lib/cache/contact-attribute";
import { contactAttributeKeyCache } from "@/lib/cache/contact-attribute-key";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";

export const hasEmailAttribute = reactCache(
  async (email: string, environmentId: string, contactId: string): Promise<boolean> =>
    cache(
      async () => {
        const contactAttribute = await prisma.contactAttribute.findFirst({
          where: {
            AND: [
              {
                attributeKey: {
                  key: "email",
                  environmentId,
                },
                value: email,
              },
              {
                NOT: {
                  contactId,
                },
              },
            ],
          },
          select: { id: true },
        });

        return !!contactAttribute;
      },
      [`hasEmailAttribute-${email}-${environmentId}-${contactId}`],
      {
        tags: [
          contactAttributeKeyCache.tag.byEnvironmentIdAndKey(environmentId, "email"),
          contactAttributeCache.tag.byEnvironmentId(environmentId),
        ],
      }
    )()
);
