import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { err, ok } from "@formbricks/types/error-handlers";
import { whereContactsOfWorkspace } from "@/modules/ee/contacts/lib/contact-directory";

/** The contact, when it is in the workspace's contact directory. */
export const getContact = reactCache(async (contactId: string, workspaceId: string) => {
  try {
    const contact = await prisma.contact.findUnique({
      where: {
        id: contactId,
        ...whereContactsOfWorkspace(workspaceId),
      },
      select: {
        id: true,
      },
    });

    if (!contact) {
      return err({ type: "not_found", details: [{ field: "contact", issue: "not found" }] });
    }

    return ok(contact);
  } catch (error) {
    return err({
      type: "internal_server_error",
      details: [
        { field: "contact", issue: error instanceof Error ? error.message : "Unknown error occurred" },
      ],
    });
  }
});
