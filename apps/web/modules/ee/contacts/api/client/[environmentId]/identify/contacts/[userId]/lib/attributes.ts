import { contactAttributeCache } from "@/lib/cache/contact-attribute";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { ZId } from "@formbricks/types/common";

export const getContactAttributes = reactCache(
  (contactId: string): Promise<Record<string, string>> =>
    cache(
      async () => {
        validateInputs([contactId, ZId]);

        const contactAttributes = await prisma.contactAttribute.findMany({
          where: {
            contactId,
          },
          select: { attributeKey: { select: { key: true } }, value: true },
        });

        const transformedContactAttributes: Record<string, string> = contactAttributes.reduce((acc, attr) => {
          acc[attr.attributeKey.key] = attr.value;

          return acc;
        }, {});

        return transformedContactAttributes;
      },
      [`getContactAttrubutes-contactId-${contactId}`],
      {
        tags: [contactAttributeCache.tag.byContactId(contactId)],
      }
    )()
);
