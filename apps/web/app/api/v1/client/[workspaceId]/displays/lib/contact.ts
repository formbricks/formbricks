import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { whereDirectoryAttributeKey } from "@/modules/ee/contacts/lib/attribute-key-scope";

/** The contact with this userId in the directory, whichever workspace of the directory created it. */
export const getContactByUserId = reactCache(
  async (
    directoryId: string,
    userId: string
  ): Promise<{
    id: string;
  } | null> => {
    const contact = await prisma.contact.findFirst({
      where: {
        attributes: {
          some: {
            attributeKey: whereDirectoryAttributeKey(directoryId, "userId"),
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
