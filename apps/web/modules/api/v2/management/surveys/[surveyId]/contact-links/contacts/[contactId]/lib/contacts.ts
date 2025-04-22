import { cache } from "@/lib/cache";
import { contactCache } from "@/lib/cache/contact";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { Contact } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Result, err, ok } from "@formbricks/types/error-handlers";

export const getContact = reactCache(async (contactId: string, environmentId: string) =>
  cache(
    async (): Promise<Result<Pick<Contact, "id">, ApiErrorResponseV2>> => {
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
    },
    [`contact-link-getContact-${contactId}-${environmentId}`],
    {
      tags: [contactCache.tag.byId(contactId), contactCache.tag.byEnvironmentId(environmentId)],
    }
  )()
);
