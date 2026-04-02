import { NextRequest } from "next/server";
import { authenticatedApiClient } from "@/modules/api/v2/auth/authenticated-api-client";
import { responses } from "@/modules/api/v2/lib/response";
import { handleApiError } from "@/modules/api/v2/lib/utils";
import {
  createContactAttributeKey,
  getContactAttributeKeys,
} from "@/modules/api/v2/management/contact-attribute-keys/lib/contact-attribute-key";
import {
  ZContactAttributeKeyCreateInput,
  ZGetContactAttributeKeysFilter,
} from "@/modules/api/v2/management/contact-attribute-keys/types/contact-attribute-keys";
import { resolveWorkspaceInBodyV2 } from "@/modules/api/v2/management/lib/workspace-resolver";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";

export const GET = async (request: NextRequest) =>
  authenticatedApiClient({
    request,
    schemas: {
      query: ZGetContactAttributeKeysFilter,
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
      body: ZContactAttributeKeyCreateInput,
    },
    handler: async ({ authentication, parsedInput, auditLog }) => {
      const { body } = parsedInput;

      // Resolve workspaceId → production environmentId when environmentId is not provided
      const envResult = await resolveWorkspaceInBodyV2(body, authentication.environmentPermissions, "POST");
      if (!envResult.ok) {
        return handleApiError(request, envResult.error, auditLog);
      }

      const createContactAttributeKeyResult = await createContactAttributeKey({
        ...body,
        environmentId: envResult.data,
      });

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
