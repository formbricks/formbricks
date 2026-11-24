import { NextRequest } from "next/server";
import { can } from "@/lib/authorization";
import { getWorkspaceAuthorizationActionForMethod } from "@/lib/authorization/permission-action";
import { authenticatedApiClient } from "@/modules/api/v2/auth/authenticated-api-client";
import { responses } from "@/modules/api/v2/lib/response";
import { formatZodError, handleApiError } from "@/modules/api/v2/lib/utils";
import { resolveBodyIdsV2 } from "@/modules/api/v2/management/lib/workspace-resolver";
import { createContact } from "@/modules/ee/contacts/api/v2/management/contacts/lib/contact";
import { ZContactCreateRequest, getContactCreateRequestSchema } from "@/modules/ee/contacts/types/contact";
import { checkContactDirectoryApiV2 } from "@/modules/ee/license-check/lib/contacts-api-guard";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";

export const POST = async (request: NextRequest) =>
  authenticatedApiClient({
    request,
    schemas: {
      body: ZContactCreateRequest,
    },
    bodyTransform: async (body, auth) => {
      const resolved = await resolveBodyIdsV2(body, auth, "POST");
      // eslint-disable-next-line typescript/only-throw-error -- the API wrapper turns a thrown error response into its reply
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

      if (
        !(await can(
          { type: "apiKey", id: authentication.apiKeyId },
          getWorkspaceAuthorizationActionForMethod("POST"),
          { type: "workspace", id: workspaceId }
        ))
      ) {
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

      const directoryResult = await checkContactDirectoryApiV2(workspaceId);
      if (!directoryResult.ok) {
        return handleApiError(request, directoryResult.error, auditLog);
      }
      const directory = directoryResult.data;

      // The identity attribute depends on the directory's matching key, known only now.
      const identityCheck = getContactCreateRequestSchema(directory.matchingKey).safeParse(body);
      if (!identityCheck.success) {
        return handleApiError(
          request,
          { type: "unprocessable_entity", details: formatZodError(identityCheck.error) },
          auditLog
        );
      }

      const createContactResult = await createContact(body, directory);

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
