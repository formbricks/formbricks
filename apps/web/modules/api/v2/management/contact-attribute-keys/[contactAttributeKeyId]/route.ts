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
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
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
        return handleApiError(request, res.error as ApiErrorResponseV2);
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
    handler: async ({ authentication, parsedInput, auditLog }) => {
      const { params, body } = parsedInput;

      if (auditLog) {
        auditLog.targetId = params.contactAttributeKeyId;
      }

      const res = await getContactAttributeKey(params.contactAttributeKeyId);

      if (!res.ok) {
        return handleApiError(request, res.error as ApiErrorResponseV2, auditLog);
      }
      if (!hasPermission(authentication.environmentPermissions, res.data.environmentId, "PUT")) {
        return handleApiError(
          request,
          {
            type: "unauthorized",
            details: [{ field: "environment", issue: "unauthorized" }],
          },
          auditLog
        );
      }

      if (res.data.isUnique) {
        return handleApiError(
          request,
          {
            type: "bad_request",
            details: [{ field: "contactAttributeKey", issue: "cannot update unique contact attribute key" }],
          },
          auditLog
        );
      }

      const updatedContactAttributeKey = await updateContactAttributeKey(params.contactAttributeKeyId, body);

      if (!updatedContactAttributeKey.ok) {
        return handleApiError(request, updatedContactAttributeKey.error, auditLog);
      }

      if (auditLog) {
        auditLog.oldObject = res.data;
        auditLog.newObject = updatedContactAttributeKey.data;
      }

      return responses.successResponse(updatedContactAttributeKey);
    },
    action: "updated",
    targetType: "contactAttributeKey",
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
    handler: async ({ authentication, parsedInput, auditLog }) => {
      const { params } = parsedInput;

      if (auditLog) {
        auditLog.targetId = params.contactAttributeKeyId;
      }

      const res = await getContactAttributeKey(params.contactAttributeKeyId);

      if (!res.ok) {
        return handleApiError(request, res.error as ApiErrorResponseV2, auditLog);
      }

      if (!hasPermission(authentication.environmentPermissions, res.data.environmentId, "DELETE")) {
        return handleApiError(
          request,
          {
            type: "unauthorized",
            details: [{ field: "environment", issue: "unauthorized" }],
          },
          auditLog
        );
      }

      if (res.data.isUnique) {
        return handleApiError(
          request,
          {
            type: "bad_request",
            details: [{ field: "contactAttributeKey", issue: "cannot delete unique contactAttributeKey" }],
          },
          auditLog
        );
      }

      const deletedContactAttributeKey = await deleteContactAttributeKey(params.contactAttributeKeyId);

      if (!deletedContactAttributeKey.ok) {
        return handleApiError(request, deletedContactAttributeKey.error as ApiErrorResponseV2, auditLog); // NOSONAR // We need to assert or we get a type error
      }

      if (auditLog) {
        auditLog.oldObject = res.data;
      }

      return responses.successResponse(deletedContactAttributeKey);
    },
    action: "deleted",
    targetType: "contactAttributeKey",
  });
