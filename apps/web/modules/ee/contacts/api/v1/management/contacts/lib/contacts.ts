import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { ZId } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";
import { validateInputs } from "@/lib/utils/validate";
import { getReportingWorkspaceByDirectory } from "@/modules/ee/contacts/lib/contact-directory";
import { TContact } from "@/modules/ee/contacts/types/contact";

/**
 * The v1 contact shape, pinned (decision 9): columns added to `Contact` later (`directoryId` first) must
 * not reach v1 responses. `directoryId` is read to place the contact, then dropped.
 */
export const selectV1Contact = {
  id: true,
  createdAt: true,
  updatedAt: true,
  workspaceId: true,
} satisfies Prisma.ContactSelect;

/**
 * A contact's `workspaceId` is the workspace it was created from, and is null once that workspace is
 * deleted while the directory lives on. v1 keeps the field non-null: it falls back to the caller's
 * workspace on the contact's directory.
 */
export const toV1Contact = (
  contact: Prisma.ContactGetPayload<{ select: typeof selectV1Contact }>,
  callerWorkspaceId: string
): TContact => ({
  id: contact.id,
  createdAt: contact.createdAt,
  updatedAt: contact.updatedAt,
  workspaceId: contact.workspaceId ?? callerWorkspaceId,
});

/** Every contact of the contact directories the given workspaces use, each listed once. */
export const getContacts = reactCache(async (workspaceIds: string[]): Promise<TContact[]> => {
  validateInputs([workspaceIds, ZId.array()]);

  try {
    const workspaceByDirectory = await getReportingWorkspaceByDirectory(workspaceIds);
    if (workspaceByDirectory.size === 0) return [];

    const contacts = await prisma.contact.findMany({
      where: { directoryId: { in: [...workspaceByDirectory.keys()] } },
      select: { ...selectV1Contact, directoryId: true },
    });

    return contacts.flatMap(({ directoryId, ...contact }) => {
      const callerWorkspaceId = directoryId ? workspaceByDirectory.get(directoryId) : undefined;
      return callerWorkspaceId ? [toV1Contact(contact, callerWorkspaceId)] : [];
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
});
