import { authenticatedApiClient } from "@/modules/api/v2/auth/authenticated-api-client";
import { responses } from "@/modules/api/v2/lib/response";
import { handleApiError } from "@/modules/api/v2/lib/utils";
import { createContact } from "@/modules/ee/contacts/api/v2/management/contacts/lib/contact";
import { ZContactCreateRequest } from "@/modules/ee/contacts/types/contact";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";
import { NextRequest } from "next/server";

export const POST = async (request: NextRequest) =>
  authenticatedApiClient({
    request,
    schemas: {
      body: ZContactCreateRequest,
    },

    handler: async ({ authentication, parsedInput, auditLog }) => {
      const { body } = parsedInput;
      const isContactsEnabled = await getIsContactsEnabled();
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

      const { environmentId } = body;

      if (!hasPermission(authentication.environmentPermissions, environmentId, "POST")) {
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
