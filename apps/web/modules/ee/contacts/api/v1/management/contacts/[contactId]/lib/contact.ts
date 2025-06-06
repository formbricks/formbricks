import { validateInputs } from "@/lib/utils/validate";
import { TContact } from "@/modules/ee/contacts/types/contact";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";

export const getContact = reactCache(async (contactId: string): Promise<TContact | null> => {
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
});

export const deleteContact = async (contactId: string): Promise<void> => {
  validateInputs([contactId, ZId]);

  try {
    await prisma.contact.delete({
      where: { id: contactId },
      select: {
        id: true,
        environmentId: true,
        attributes: { select: { attributeKey: { select: { key: true } }, value: true } },
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};
