import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { err, ok } from "@formbricks/types/error-handlers";

export const getContact = reactCache(async (contactId: string, environmentId: string) => {
  try {
    const contact = await prisma.contact.findUnique({
      where: {
        id: contactId,
        environmentId,
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
    return err({ type: "internal_server_error", details: [{ field: "contact", issue: error.message }] });
  }
});
