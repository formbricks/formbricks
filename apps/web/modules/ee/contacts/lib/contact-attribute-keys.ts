import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";

export const getContactAttributeKeys = reactCache(
  async (environmentId: string): Promise<TContactAttributeKey[]> => {
    return await prisma.contactAttributeKey.findMany({
      where: { environmentId },
    });
  }
);
