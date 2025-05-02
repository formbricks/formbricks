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

      const res = await getContactAttributeKey(params.contactAttributeKeyId);

      if (!res.ok) {
        return handleApiError(request, res.error);
      }
      if (!hasPermission(authentication.environmentPermissions, res.data.environmentId, "PUT")) {
        return handleApiError(request, {
          type: "unauthorized",
          details: [{ field: "environment", issue: "unauthorized" }],
        });
      }

      if (res.data.isUnique) {
        return handleApiError(request, {
          type: "bad_request",
          details: [{ field: "contactAttributeKey", issue: "cannot update unique contact attribute key" }],
        });
      }

      const updatedContactAttributeKey = await updateContactAttributeKey(params.contactAttributeKeyId, body);

      if (!updatedContactAttributeKey.ok) {
        return handleApiError(request, updatedContactAttributeKey.error);
      }

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

      const res = await getContactAttributeKey(params.contactAttributeKeyId);

      if (!res.ok) {
        return handleApiError(request, res.error);
      }

      if (!hasPermission(authentication.environmentPermissions, res.data.environmentId, "DELETE")) {
        return handleApiError(request, {
          type: "unauthorized",
          details: [{ field: "environment", issue: "unauthorized" }],
        });
      }

      if (res.data.isUnique) {
        return handleApiError(request, {
          type: "bad_request",
          details: [{ field: "contactAttributeKey", issue: "cannot delete unique contact attribute key" }],
        });
      }

      const deletedContactAttributeKey = await deleteContactAttributeKey(params.contactAttributeKeyId);

      if (!deletedContactAttributeKey.ok) {
        return handleApiError(request, deletedContactAttributeKey.error);
      }

      return responses.successResponse(deletedContactAttributeKey);
    },
  });
