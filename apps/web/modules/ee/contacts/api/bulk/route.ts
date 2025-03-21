import { transformErrorToDetails } from "@/app/lib/api/validator";
import { responses } from "@/modules/api/v2/lib/response";
import { authenticateRequest } from "@/modules/api/v2/management/auth/authenticate-request";
import { upsertBulkContacts } from "@/modules/ee/contacts/api/bulk/lib/contact";
import { ZContactBulkUploadRequest } from "@/modules/ee/contacts/types/contact";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { createId } from "@paralleldrive/cuid2";
import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { ZUserEmail } from "@formbricks/types/user";

export const PUT = async (request: NextRequest) => {
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication.ok) return responses.unauthorizedResponse();

    const isContactsEnabled = await getIsContactsEnabled();
    if (!isContactsEnabled) {
      return responses.forbiddenResponse();
    }

    const json = await request.json();
    const parsedInput = ZContactBulkUploadRequest.safeParse(json);

    if (!parsedInput.success) {
      const details = Object.entries(transformErrorToDetails(parsedInput.error)).map(([field, issue]) => ({
        field,
        issue,
      }));

      return responses.badRequestResponse({
        details,
      });
    }

    const { contacts } = parsedInput.data;
    const { environmentId } = authentication.data;

    const emailKey = "email";

    const seenEmails = new Set<string>();
    const duplicateEmails = new Set<string>();

    for (const contact of contacts) {
      const email = contact.attributes.find((attr) => attr.attributeKey.key === emailKey)?.value;

      if (email) {
        if (seenEmails.has(email)) {
          duplicateEmails.add(email);
        } else {
          seenEmails.add(email);
        }
      }
    }

    // Filter out any contacts that have a duplicate email.
    // All contacts with an email that appears more than once will be excluded.
    const filteredContactsByEmail = contacts.filter((contact) => {
      const email = contact.attributes.find((attr) => attr.attributeKey.key === emailKey)?.value;
      return email && !duplicateEmails.has(email);
    });

    if (filteredContactsByEmail.length === 0) {
      return responses.badRequestResponse({
        details: [
          { field: "contacts", issue: "No valid contacts to process after filtering duplicate emails" },
        ],
      });
    }

    // duplicate userIds
    const seenUserIds = new Set<string>();
    const duplicateUserIds = new Set<string>();

    for (const contact of filteredContactsByEmail) {
      const userId = contact.attributes.find((attr) => attr.attributeKey.key === "userId")?.value;

      if (userId) {
        if (seenUserIds.has(userId)) {
          duplicateUserIds.add(userId);
        } else {
          seenUserIds.add(userId);
        }
      }
    }

    // userIds need to be unique, so we get rid of all the contacts with duplicate userIds
    const filteredContacts = filteredContactsByEmail.filter((contact) => {
      const userId = contact.attributes.find((attr) => attr.attributeKey.key === "userId")?.value;
      if (userId) {
        return !duplicateUserIds.has(userId);
      }

      return true;
    });

    if (filteredContacts.length === 0) {
      return responses.badRequestResponse({
        details: [
          { field: "contacts", issue: "No valid contacts to process after filtering duplicate userIds" },
        ],
      });
    }

    const emails = filteredContacts
      .map((contact) => contact.attributes.find((attr) => attr.attributeKey.key === emailKey)?.value)
      .filter((email): email is string => Boolean(email));

    if (!emails.length) {
      return responses.badRequestResponse({
        details: [{ field: "contacts", issue: "No email found for any contact, please check your contacts" }],
      });
    }

    const parsedEmails = z.array(ZUserEmail).safeParse(emails);
    if (!parsedEmails.success) {
      return responses.badRequestResponse({
        details: [
          { field: "contacts", issue: "Invalid email found for some contacts, please check your contacts" },
        ],
      });
    }

    await upsertBulkContacts(filteredContacts, environmentId, parsedEmails.data);

    return responses.successResponse({
      data: {
        message: "Contacts bulk upload successful",
        duplicateEmails: Array.from(duplicateEmails),
        duplicateUserIds: Array.from(duplicateUserIds),
        processedContacts: filteredContacts.length,
      },
    });
  } catch (error) {
    console.log(error.stack);
    return responses.internalServerErrorResponse();
  }
};
