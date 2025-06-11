import "server-only";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";

export const getContactByUserId = reactCache(
  async (
    environmentId: string,
    userId: string
  ): Promise<{
    attributes: {
      value: string;
      attributeKey: {
        key: string;
      };
    }[];
    id: string;
  } | null> => {
    const contact = await prisma.contact.findFirst({
      where: {
        attributes: {
          some: {
            attributeKey: {
              key: "userId",
              environmentId,
            },
            value: userId,
          },
        },
      },
      select: {
        id: true,
        attributes: { select: { attributeKey: { select: { key: true } }, value: true } },
      },
    });

    if (!contact) {
      return null;
    }

    return contact;
  }
);
