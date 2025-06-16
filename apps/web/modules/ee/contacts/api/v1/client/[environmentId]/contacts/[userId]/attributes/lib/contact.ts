import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";

export const getContactByUserIdWithAttributes = reactCache(
  async (environmentId: string, userId: string, updatedAttributes: Record<string, string>) => {
    const contact = await prisma.contact.findFirst({
      where: {
        environmentId,
        attributes: { some: { attributeKey: { key: "userId", environmentId }, value: userId } },
      },
      select: {
        id: true,
        attributes: {
          where: {
            attributeKey: {
              key: {
                in: Object.keys(updatedAttributes),
              },
            },
          },
          select: { attributeKey: { select: { key: true } }, value: true },
        },
      },
    });

    if (!contact) {
      return null;
    }

    return contact;
  }
);
