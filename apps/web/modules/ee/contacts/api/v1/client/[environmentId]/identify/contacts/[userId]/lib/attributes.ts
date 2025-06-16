import { validateInputs } from "@/lib/utils/validate";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/common";

export const getContactAttributes = reactCache(async (contactId: string): Promise<Record<string, string>> => {
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
});
