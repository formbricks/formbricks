import { authenticatedApiClient } from "@/modules/api/v2/auth/authenticated-api-client";
import { responses } from "@/modules/api/v2/lib/response";
import { handleApiError } from "@/modules/api/v2/lib/utils";
import { resolveBodyIdsV2 } from "@/modules/api/v2/management/lib/workspace-resolver";
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
    bodyTransform: async (body, auth) => {
      const resolved = await resolveBodyIdsV2(body, auth.environmentPermissions, "PUT");
      if (!resolved.ok) throw resolved.error;
      return { ...body, ...resolved.data };
    },
    handler: async ({ authentication, parsedInput, auditLog }) => {
      const isContactsEnabled = await getIsContactsEnabled(authentication.organizationId);
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

      const workspaceId = parsedInput.body?.workspaceId;

      if (!workspaceId) {
        return handleApiError(
          request,
          {
            type: "bad_request",
            details: [{ field: "workspaceId", issue: "missing" }],
          },
          auditLog
        );
      }

      const { contacts } = parsedInput.body ?? { contacts: [] };

      const perm = authentication.environmentPermissions.find((p) => p.workspaceId === workspaceId);
      if (!perm || !hasPermission(authentication.environmentPermissions, perm.workspaceId, "PUT")) {
        return handleApiError(
          request,
          {
            type: "forbidden",
            details: [
              {
                field: "workspaceId",
                issue: "insufficient permissions to create contact in this workspace",
              },
            ],
          },
          auditLog
        );
      }

      const emails = contacts.map(
        (contact) => contact.attributes.find((attr) => attr.attributeKey.key === "email")?.value!
      );

      const upsertBulkContactsResult = await upsertBulkContacts(contacts, workspaceId, emails);

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
