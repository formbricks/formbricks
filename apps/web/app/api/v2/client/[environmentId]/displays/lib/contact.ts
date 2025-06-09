import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";

export const doesContactExist = reactCache(async (id: string): Promise<boolean> => {
  const contact = await prisma.contact.findFirst({
    where: {
      id,
    },
    select: {
      id: true,
    },
  });

  return !!contact;
});
