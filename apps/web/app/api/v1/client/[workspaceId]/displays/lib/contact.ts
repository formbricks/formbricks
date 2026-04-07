import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";

export const getContactByUserId = reactCache(
  async (
    workspaceId: string,
    userId: string
  ): Promise<{
    id: string;
  } | null> => {
    const contact = await prisma.contact.findFirst({
      where: {
        attributes: {
          some: {
            attributeKey: {
              key: "userId",
              workspaceId,
            },
            value: userId,
          },
        },
      },
      select: { id: true },
    });

    if (!contact) {
      return null;
    }

    return contact;
  }
);
