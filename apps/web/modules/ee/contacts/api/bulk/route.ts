import { responses } from "@/modules/api/v2/lib/response";
import { handleApiError } from "@/modules/api/v2/lib/utils";
import { authenticatedApiClient } from "@/modules/api/v2/management/auth/authenticated-api-client";
import { upsertBulkContacts } from "@/modules/ee/contacts/api/bulk/lib/contact";
import { ZContactBulkUploadRequest } from "@/modules/ee/contacts/types/contact";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";

export const PUT = async (request: Request) =>
  authenticatedApiClient({
    request,
    schemas: {
      body: ZContactBulkUploadRequest,
    },
    handler: async ({ authentication, parsedInput }) => {
      const isContactsEnabled = await getIsContactsEnabled();
      if (!isContactsEnabled) {
        return handleApiError(request, {
          type: "forbidden",
          details: [{ field: "error", issue: "Contacts are not enabled for this environment." }],
        });
      }

      const { contacts } = parsedInput.body ?? { contacts: [] };
      const { environmentId } = authentication;

      const emails = contacts.map(
        (contact) => contact.attributes.find((attr) => attr.attributeKey.key === "email")?.value!
      );

      const { contactIdxWithConflictingUserIds } = await upsertBulkContacts(contacts, environmentId, emails);

      if (contactIdxWithConflictingUserIds.length) {
        return responses.multiStatusResponse({
          data: {
            status: "success",
            message:
              "Contacts bulk upload partially successful. Some contacts were skipped due to conflicting userIds.",
            skippedContacts: contactIdxWithConflictingUserIds.map((idx) => ({
              index: idx,
              userId: contacts[idx].attributes.find((attr) => attr.attributeKey.key === "userId")?.value,
            })),
          },
        });
      }

      return responses.successResponse({
        data: {
          status: "success",
          message: "Contacts bulk upload successful",
          processed: contacts.length,
        },
      });
    },
  });
