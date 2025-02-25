import { responses } from "@/modules/api/lib/response";
import { handleApiError } from "@/modules/api/lib/utils";
import { authenticatedApiClient, checkAuthorization } from "@/modules/api/management/auth";
import { getEnvironmentIdFromResponseId } from "@/modules/api/management/lib/helper";
import {
  deleteResponse,
  getResponse,
  updateResponse,
} from "@/modules/api/management/responses/[responseId]/lib/response";
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

      const environmentIdResult = await getEnvironmentIdFromResponseId(params.responseId);
      if (!environmentIdResult.ok) {
        return handleApiError(request, environmentIdResult.error);
      }

      const checkAuthorizationResult = await checkAuthorization({
        authentication,
        environmentId: environmentIdResult.data,
      });

      if (!checkAuthorizationResult.ok) {
        return handleApiError(request, checkAuthorizationResult.error);
      }

      const response = await getResponse(params.responseId);
      if (!response.ok) {
        return handleApiError(request, response.error);
      }

      return responses.successResponse({ data: response.data });
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

      const environmentIdResult = await getEnvironmentIdFromResponseId(params.responseId);
      if (!environmentIdResult.ok) {
        return handleApiError(request, environmentIdResult.error);
      }

      const checkAuthorizationResult = await checkAuthorization({
        authentication,
        environmentId: environmentIdResult.data,
      });

      if (!checkAuthorizationResult.ok) {
        return handleApiError(request, checkAuthorizationResult.error);
      }

      const response = await deleteResponse(params.responseId);

      if (!response.ok) {
        return handleApiError(request, response.error);
      }

      return responses.successResponse({ data: response.data });
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

      const environmentIdResult = await getEnvironmentIdFromResponseId(params.responseId);
      if (!environmentIdResult.ok) {
        return handleApiError(request, environmentIdResult.error);
      }

      const checkAuthorizationResult = await checkAuthorization({
        authentication,
        environmentId: environmentIdResult.data,
      });

      if (!checkAuthorizationResult.ok) {
        return handleApiError(request, checkAuthorizationResult.error);
      }

      const response = await updateResponse(params.responseId, body);

      if (!response.ok) {
        return handleApiError(request, response.error);
      }

      return responses.successResponse({ data: response.data });
    },
  });
