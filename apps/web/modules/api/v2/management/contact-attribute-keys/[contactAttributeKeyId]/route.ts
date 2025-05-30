import { authenticatedApiClient } from "@/modules/api/v2/auth/authenticated-api-client";
import { responses } from "@/modules/api/v2/lib/response";
import { handleApiError } from "@/modules/api/v2/lib/utils";
import {
  deleteContactAttributeKey,
  getContactAttributeKey,
  updateContactAttributeKey,
} from "@/modules/api/v2/management/contact-attribute-keys/[contactAttributeKeyId]/lib/contact-attribute-key";
import {
  ZContactAttributeKeyIdSchema,
  ZContactAttributeKeyUpdateSchema,
} from "@/modules/api/v2/management/contact-attribute-keys/[contactAttributeKeyId]/types/contact-attribute-keys";
import { queueAuditEvent } from "@/modules/ee/audit-logs/lib/handler";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";
import { NextRequest } from "next/server";
import { z } from "zod";

export const GET = async (
  request: NextRequest,
  props: { params: Promise<{ contactAttributeKeyId: string }> }
) =>
  authenticatedApiClient({
    request,
    schemas: {
      params: z.object({ contactAttributeKeyId: ZContactAttributeKeyIdSchema }),
    },
    externalParams: props.params,
    handler: async ({ authentication, parsedInput }) => {
      const { params } = parsedInput;

      const res = await getContactAttributeKey(params.contactAttributeKeyId);

      if (!res.ok) {
        return handleApiError(request, res.error);
      }

      if (!hasPermission(authentication.environmentPermissions, res.data.environmentId, "GET")) {
        return handleApiError(request, {
          type: "unauthorized",
          details: [{ field: "environment", issue: "unauthorized" }],
        });
      }

      return responses.successResponse(res);
    },
  });

export const PUT = async (
  request: NextRequest,
  props: { params: Promise<{ contactAttributeKeyId: string }> }
) =>
  authenticatedApiClient({
    request,
    schemas: {
      params: z.object({ contactAttributeKeyId: ZContactAttributeKeyIdSchema }),
      body: ZContactAttributeKeyUpdateSchema,
    },
    externalParams: props.params,
    handler: async ({ authentication, parsedInput }) => {
      const { params, body } = parsedInput;

      const auditLogBase = {
        actionType: "contactAttributeKey.updated" as const,
        targetType: "contactAttributeKey" as const,
        userId: authentication.apiKeyId,
        userType: "api" as const,
        targetId: params.contactAttributeKeyId,
        organizationId: authentication.organizationId,
        status: "failure" as const,
        apiUrl: request.url,
      };

      const res = await getContactAttributeKey(params.contactAttributeKeyId);

      if (!res.ok) {
        return handleApiError(request, res.error, auditLogBase);
      }
      if (!hasPermission(authentication.environmentPermissions, res.data.environmentId, "PUT")) {
        return handleApiError(
          request,
          {
            type: "unauthorized",
            details: [{ field: "environment", issue: "unauthorized" }],
          },
          auditLogBase
        );
      }

      if (res.data.isUnique) {
        return handleApiError(
          request,
          {
            type: "bad_request",
            details: [{ field: "contactAttributeKey", issue: "cannot update unique contact attribute key" }],
          },
          auditLogBase
        );
      }

      const updatedContactAttributeKey = await updateContactAttributeKey(params.contactAttributeKeyId, body);

      if (!updatedContactAttributeKey.ok) {
        return handleApiError(request, updatedContactAttributeKey.error, auditLogBase);
      }

      queueAuditEvent({
        ...auditLogBase,
        status: "success",
        oldObject: res.data,
        newObject: updatedContactAttributeKey.data,
      });

      return responses.successResponse(updatedContactAttributeKey);
    },
  });

export const DELETE = async (
  request: NextRequest,
  props: { params: Promise<{ contactAttributeKeyId: string }> }
) =>
  authenticatedApiClient({
    request,
    schemas: {
      params: z.object({ contactAttributeKeyId: ZContactAttributeKeyIdSchema }),
    },
    externalParams: props.params,
    handler: async ({ authentication, parsedInput }) => {
      const { params } = parsedInput;

      const auditLogBase = {
        actionType: "contactAttributeKey.deleted" as const,
        targetType: "contactAttributeKey" as const,
        userId: authentication.apiKeyId,
        userType: "api" as const,
        targetId: params.contactAttributeKeyId,
        organizationId: authentication.organizationId,
        status: "failure" as const,
        apiUrl: request.url,
      };

      const res = await getContactAttributeKey(params.contactAttributeKeyId);

      if (!res.ok) {
        return handleApiError(request, res.error, auditLogBase);
      }

      if (!hasPermission(authentication.environmentPermissions, res.data.environmentId, "DELETE")) {
        return handleApiError(
          request,
          {
            type: "unauthorized",
            details: [{ field: "environment", issue: "unauthorized" }],
          },
          auditLogBase
        );
      }

      if (res.data.isUnique) {
        return handleApiError(
          request,
          {
            type: "bad_request",
            details: [{ field: "contactAttributeKey", issue: "cannot delete unique contactAttributeKey" }],
          },
          auditLogBase
        );
      }

      const deletedContactAttributeKey = await deleteContactAttributeKey(params.contactAttributeKeyId);

      if (!deletedContactAttributeKey.ok) {
        return handleApiError(request, deletedContactAttributeKey.error, auditLogBase);
      }

      queueAuditEvent({
        ...auditLogBase,
        status: "success",
        oldObject: res.data,
      });

      return responses.successResponse(deletedContactAttributeKey);
    },
  });
