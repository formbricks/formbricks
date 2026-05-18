import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";

export const getIsEmailUnique = reactCache(async (email: string): Promise<boolean> => {
  const user = await prisma.user.findUnique({
    where: {
      email: email.toLowerCase(),
    },
    select: {
      id: true,
    },
  });

  return !user;
});
