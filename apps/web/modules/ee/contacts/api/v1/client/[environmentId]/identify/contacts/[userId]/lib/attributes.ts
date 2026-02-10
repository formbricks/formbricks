import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/common";
import { validateInputs } from "@/lib/utils/validate";
import { readAttributeValue } from "@/modules/ee/contacts/lib/attribute-storage";

export const getContactAttributes = reactCache(async (contactId: string): Promise<Record<string, string>> => {
  validateInputs([contactId, ZId]);

  const contactAttributes = await prisma.contactAttribute.findMany({
    where: {
      contactId,
    },
    select: {
      value: true,
      valueNumber: true,
      valueDate: true,
      attributeKey: { select: { key: true, dataType: true } },
    },
  });

  const transformedContactAttributes: Record<string, string> = contactAttributes.reduce((acc, attr) => {
    acc[attr.attributeKey.key] = readAttributeValue(attr, attr.attributeKey.dataType);

    return acc;
  }, {});

  return transformedContactAttributes;
});
