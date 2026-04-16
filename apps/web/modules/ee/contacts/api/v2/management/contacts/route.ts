import { NextRequest } from "next/server";
import { authenticatedApiClient } from "@/modules/api/v2/auth/authenticated-api-client";
import { responses } from "@/modules/api/v2/lib/response";
import { handleApiError } from "@/modules/api/v2/lib/utils";
import { resolveBodyIdsV2 } from "@/modules/api/v2/management/lib/workspace-resolver";
import { createContact } from "@/modules/ee/contacts/api/v2/management/contacts/lib/contact";
import { ZContactCreateRequest } from "@/modules/ee/contacts/types/contact";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";

export const POST = async (request: NextRequest) =>
  authenticatedApiClient({
    request,
    schemas: {
      body: ZContactCreateRequest,
    },
    bodyTransform: async (body, auth) => {
      const resolved = await resolveBodyIdsV2(body, auth.workspacePermissions, "POST");
      if (!resolved.ok) throw resolved.error;
      return { ...body, ...resolved.data };
    },

    handler: async ({ authentication, parsedInput, auditLog }) => {
      const { body } = parsedInput;
      const isContactsEnabled = await getIsContactsEnabled(authentication.organizationId);
      if (!isContactsEnabled) {
        return handleApiError(
          request,
          {
            type: "forbidden",
            details: [{ field: "contacts", issue: "Contacts feature is not enabled for this environment" }],
          },
          auditLog
        );
      }

      const { workspaceId } = body;

      const perm = authentication.workspacePermissions.find((p) => p.workspaceId === workspaceId);
      if (!perm || !hasPermission(authentication.workspacePermissions, perm.workspaceId, "POST")) {
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

      const createContactResult = await createContact(body);

      if (!createContactResult.ok) {
        return handleApiError(request, createContactResult.error, auditLog);
      }

      const createdContact = createContactResult.data;

      if (auditLog) {
        auditLog.targetId = createdContact.id;
        auditLog.newObject = createdContact;
      }

      return responses.createdResponse(createContactResult);
    },
    action: "created",
    targetType: "contact",
  });
