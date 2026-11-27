import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { ZId } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";
import { validateInputs } from "@/lib/utils/validate";
import { selectV1Contact } from "@/modules/ee/contacts/api/v1/management/contacts/lib/contacts";

/** The contact with its directory, which decides who may reach it; null when it does not exist. */
export const getContact = reactCache(async (contactId: string) => {
  validateInputs([contactId, ZId]);

  try {
    return await prisma.contact.findUnique({
      where: { id: contactId },
      select: { ...selectV1Contact, directoryId: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
});
