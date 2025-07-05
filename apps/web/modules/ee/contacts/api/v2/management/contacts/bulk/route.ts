import { authenticatedApiClient } from "@/modules/api/v2/auth/authenticated-api-client";
import { responses } from "@/modules/api/v2/lib/response";
import { handleApiError } from "@/modules/api/v2/lib/utils";
import { upsertBulkContacts } from "@/modules/ee/contacts/api/v2/management/contacts/bulk/lib/contact";
import { ZContactBulkUploadRequest } from "@/modules/ee/contacts/types/contact";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";

export const PUT = async (request: Request) =>
  authenticatedApiClient({
    request,
    schemas: {
      body: ZContactBulkUploadRequest,
    },
    handler: async ({ authentication, parsedInput, auditLog }) => {
      const isContactsEnabled = await getIsContactsEnabled();
      if (!isContactsEnabled) {
        return handleApiError(
          request,
          {
            type: "forbidden",
            details: [{ field: "error", issue: "Contacts are not enabled for this environment." }],
          },
          auditLog
        );
      }

      const environmentId = parsedInput.body?.environmentId;

      if (!environmentId) {
        return handleApiError(
          request,
          {
            type: "bad_request",
            details: [{ field: "environmentId", issue: "missing" }],
          },
          auditLog
        );
      }

      const { contacts } = parsedInput.body ?? { contacts: [] };

      if (!hasPermission(authentication.environmentPermissions, environmentId, "PUT")) {
        return handleApiError(
          request,
          {
            type: "forbidden",
            details: [
              {
                field: "environmentId",
                issue: "insufficient permissions to create contact in this environment",
              },
            ],
          },
          auditLog
        );
      }

      const emails = contacts.map(
        (contact) => contact.attributes.find((attr) => attr.attributeKey.key === "email")?.value!
      );

      const upsertBulkContactsResult = await upsertBulkContacts(contacts, environmentId, emails);

      if (!upsertBulkContactsResult.ok) {
        return handleApiError(request, upsertBulkContactsResult.error, auditLog);
      }

      const { contactIdxWithConflictingUserIds } = upsertBulkContactsResult.data;

      if (contactIdxWithConflictingUserIds.length) {
        return responses.multiStatusResponse({
          data: {
            status: "success",
            message:
              "Contacts bulk upload partially successful. Some contacts were skipped due to conflicting userIds.",
            meta: {
              skippedContacts: contactIdxWithConflictingUserIds.map((idx) => ({
                index: idx,
                userId: contacts[idx].attributes.find((attr) => attr.attributeKey.key === "userId")?.value,
              })),
            },
          },
        });
      }

      return responses.successResponse({
        data: {
          status: "success",
          message: "Contacts bulk upload successful",
        },
      });
    },
    action: "bulkCreated",
    targetType: "contact",
  });
