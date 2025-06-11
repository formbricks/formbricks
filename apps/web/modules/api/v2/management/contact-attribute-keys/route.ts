import { authenticatedApiClient } from "@/modules/api/v2/auth/authenticated-api-client";
import { responses } from "@/modules/api/v2/lib/response";
import { handleApiError } from "@/modules/api/v2/lib/utils";
import {
  createContactAttributeKey,
  getContactAttributeKeys,
} from "@/modules/api/v2/management/contact-attribute-keys/lib/contact-attribute-key";
import {
  ZContactAttributeKeyInput,
  ZGetContactAttributeKeysFilter,
} from "@/modules/api/v2/management/contact-attribute-keys/types/contact-attribute-keys";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";
import { NextRequest } from "next/server";

export const GET = async (request: NextRequest) =>
  authenticatedApiClient({
    request,
    schemas: {
      query: ZGetContactAttributeKeysFilter.sourceType(),
    },
    handler: async ({ authentication, parsedInput }) => {
      const { query } = parsedInput;

      let environmentIds: string[] = [];

      if (query.environmentId) {
        if (!hasPermission(authentication.environmentPermissions, query.environmentId, "GET")) {
          return handleApiError(request, {
            type: "unauthorized",
          });
        }
        environmentIds = [query.environmentId];
      } else {
        environmentIds = authentication.environmentPermissions.map((permission) => permission.environmentId);
      }

      const res = await getContactAttributeKeys(environmentIds, query);

      if (!res.ok) {
        return handleApiError(request, res.error as ApiErrorResponseV2);
      }

      return responses.successResponse(res.data);
    },
  });

export const POST = async (request: NextRequest) =>
  authenticatedApiClient({
    request,
    schemas: {
      body: ZContactAttributeKeyInput,
    },
    handler: async ({ authentication, parsedInput, auditLog }) => {
      const { body } = parsedInput;

      if (!hasPermission(authentication.environmentPermissions, body.environmentId, "POST")) {
        return handleApiError(
          request,
          {
            type: "forbidden",
            details: [
              { field: "environmentId", issue: "does not have permission to create contact attribute key" },
            ],
          },
          auditLog
        );
      }

      const createContactAttributeKeyResult = await createContactAttributeKey(body);

      if (!createContactAttributeKeyResult.ok) {
        return handleApiError(request, createContactAttributeKeyResult.error, auditLog);
      }

      if (auditLog) {
        auditLog.targetId = createContactAttributeKeyResult.data.id;
        auditLog.newObject = createContactAttributeKeyResult.data;
      }

      return responses.createdResponse(createContactAttributeKeyResult);
    },
    action: "created",
    targetType: "contactAttributeKey",
  });
