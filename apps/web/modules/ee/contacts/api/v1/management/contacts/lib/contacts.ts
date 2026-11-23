import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { ZId } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";
import { validateInputs } from "@/lib/utils/validate";
import { hasWorkspace } from "@/modules/ee/contacts/lib/workspace-row";
import { TContact } from "@/modules/ee/contacts/types/contact";

export const getContacts = reactCache(async (workspaceIds: string[]): Promise<TContact[]> => {
  validateInputs([workspaceIds, ZId.array()]);

  try {
    const contacts = await prisma.contact.findMany({
      where: { workspaceId: { in: workspaceIds } },
    });

    return contacts.filter(hasWorkspace);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
});
