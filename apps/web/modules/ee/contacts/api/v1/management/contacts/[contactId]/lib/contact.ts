import { cache } from "@/lib/cache";
import { contactCache } from "@/lib/cache/contact";
import { validateInputs } from "@/lib/utils/validate";
import { TContact } from "@/modules/ee/contacts/types/contact";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";

export const getContact = reactCache(
  (contactId: string): Promise<TContact | null> =>
    cache(
      async () => {
        validateInputs([contactId, ZId]);

        try {
          const contact = await prisma.contact.findUnique({
            where: { id: contactId },
          });

          if (!contact) {
            return null;
          }

          return contact;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`getContact-management-api-${contactId}`],
      {
        tags: [contactCache.tag.byId(contactId)],
      }
    )()
);

export const deleteContact = async (contactId: string): Promise<void> => {
  validateInputs([contactId, ZId]);

  try {
    const deletedContact = await prisma.contact.delete({
      where: { id: contactId },
      select: {
        id: true,
        environmentId: true,
        attributes: { select: { attributeKey: { select: { key: true } }, value: true } },
      },
    });

    const userId = deletedContact.attributes.find((attr) => attr.attributeKey.key === "userId")?.value;

    contactCache.revalidate({
      id: deletedContact.id,
      userId,
      environmentId: deletedContact.environmentId,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};
