import { authenticatedApiClient } from "@/modules/api/v2/auth/authenticated-api-client";
import { responses } from "@/modules/api/v2/lib/response";
import { handleApiError } from "@/modules/api/v2/lib/utils";
import { getEnvironmentId } from "@/modules/api/v2/management/lib/helper";
import {
  deleteResponse,
  getResponse,
  updateResponse,
} from "@/modules/api/v2/management/responses/[responseId]/lib/response";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";
import { z } from "zod";
import { responseIdSchema, responseUpdateSchema } from "./types/responses";

export const GET = async (request: Request, props: { params: Promise<{ responseId: string }> }) =>
  authenticatedApiClient({
    request,
    schemas: {
      params: z.object({ responseId: responseIdSchema }),
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

      const environmentIdResult = await getEnvironmentId(params.responseId, true);
      if (!environmentIdResult.ok) {
        return handleApiError(request, environmentIdResult.error);
      }

      if (!hasPermission(authentication.environmentPermissions, environmentIdResult.data, "GET")) {
        return handleApiError(request, {
          type: "unauthorized",
        });
      }

      const response = await getResponse(params.responseId);
      if (!response.ok) {
        return handleApiError(request, response.error);
      }

      return responses.successResponse(response);
    },
  });

export const DELETE = async (request: Request, props: { params: Promise<{ responseId: string }> }) =>
  authenticatedApiClient({
    request,
    schemas: {
      params: z.object({ responseId: responseIdSchema }),
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

      const environmentIdResult = await getEnvironmentId(params.responseId, true);
      if (!environmentIdResult.ok) {
        return handleApiError(request, environmentIdResult.error);
      }

      if (!hasPermission(authentication.environmentPermissions, environmentIdResult.data, "DELETE")) {
        return handleApiError(request, {
          type: "unauthorized",
        });
      }

      const response = await deleteResponse(params.responseId);

      if (!response.ok) {
        return handleApiError(request, response.error);
      }

      return responses.successResponse(response);
    },
  });

export const PUT = (request: Request, props: { params: Promise<{ responseId: string }> }) =>
  authenticatedApiClient({
    request,
    externalParams: props.params,
    schemas: {
      params: z.object({ responseId: responseIdSchema }),
      body: responseUpdateSchema,
    },
    handler: async ({ authentication, parsedInput }) => {
      const { body, params } = parsedInput;

      if (!body || !params) {
        return handleApiError(request, {
          type: "bad_request",
          details: [{ field: !body ? "body" : "params", issue: "missing" }],
        });
      }

      const environmentIdResult = await getEnvironmentId(params.responseId, true);
      if (!environmentIdResult.ok) {
        return handleApiError(request, environmentIdResult.error);
      }

      if (!hasPermission(authentication.environmentPermissions, environmentIdResult.data, "PUT")) {
        return handleApiError(request, {
          type: "unauthorized",
        });
      }

      const response = await updateResponse(params.responseId, body);

      if (!response.ok) {
        return handleApiError(request, response.error);
      }

      return responses.successResponse(response);
    },
  });
