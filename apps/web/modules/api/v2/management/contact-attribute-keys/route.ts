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
import { resolveBodyIdsV2 } from "@/modules/api/v2/management/lib/workspace-resolver";
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

      let workspaceIds: string[] = [];

      if (query.environmentId) {
        const permission = authentication.environmentPermissions.find(
          (p) => p.environmentId === query.environmentId
        );
        if (
          !permission ||
          !hasPermission(authentication.environmentPermissions, permission.workspaceId, "GET")
        ) {
          return handleApiError(request, {
            type: "unauthorized",
          });
        }
        workspaceIds = permission ? [permission.workspaceId] : [];
      } else {
        workspaceIds = [
          ...new Set(authentication.environmentPermissions.map((permission) => permission.workspaceId)),
        ];
      }

      const res = await getContactAttributeKeys(workspaceIds, query);

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
    bodyTransform: async (body, auth) => {
      const resolved = await resolveBodyIdsV2(body, auth.environmentPermissions, "POST");
      if (!resolved.ok) throw resolved.error;
      return { ...body, ...resolved.data };
    },
    handler: async ({ parsedInput, auditLog }) => {
      const { body } = parsedInput;

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
