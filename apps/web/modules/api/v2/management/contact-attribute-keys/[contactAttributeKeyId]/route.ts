import { authenticatedApiClient } from "@/modules/api/v2/auth/authenticated-api-client";
import { responses } from "@/modules/api/v2/lib/response";
import { handleApiError } from "@/modules/api/v2/lib/utils";
import {
  deleteContactAttributeKey,
  getContactAttributeKey,
} from "@/modules/api/v2/management/contact-attribute-keys/[contactAttributeKeyId]/lib/contact-attribute-key";
import { ZContactAttributeKeyIdSchema } from "@/modules/api/v2/management/contact-attribute-keys/[contactAttributeKeyId]/types/contact-attribute-keys";
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

      if (!params) {
        return handleApiError(request, {
          type: "bad_request",
          details: [{ field: "params", issue: "missing" }],
        });
      }

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

      if (!params) {
        return handleApiError(request, {
          type: "bad_request",
          details: [{ field: "params", issue: "missing" }],
        });
      }

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

      const deletedContactAttributeKey = await deleteContactAttributeKey(params.contactAttributeKeyId);

      if (!deletedContactAttributeKey.ok) {
        return handleApiError(request, deletedContactAttributeKey.error);
      }

      return responses.successResponse(deletedContactAttributeKey);
    },
  });
