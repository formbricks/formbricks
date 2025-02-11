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
        return responses.badRequestResponse();
      }

      const environmentIdResult = await getEnvironmentIdFromResponseId(params.responseId);
      if (!environmentIdResult.ok) {
        return handleApiError(environmentIdResult.error);
      }

      const checkAuthorizationResult = await checkAuthorization({
        authentication,
        environmentId: environmentIdResult.data,
      });

      if (!checkAuthorizationResult.ok) {
        return handleApiError(checkAuthorizationResult.error);
      }

      const response = await getResponse(params.responseId);
      if (!response.ok) {
        return handleApiError(response.error);
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
        return responses.badRequestResponse();
      }

      const environmentIdResult = await getEnvironmentIdFromResponseId(params.responseId);
      if (!environmentIdResult.ok) {
        return handleApiError(environmentIdResult.error);
      }

      const checkAuthorizationResult = await checkAuthorization({
        authentication,
        environmentId: environmentIdResult.data,
      });

      if (!checkAuthorizationResult.ok) {
        return handleApiError(checkAuthorizationResult.error);
      }

      const response = await deleteResponse(params.responseId);

      if (!response.ok) {
        return handleApiError(response.error);
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
        return responses.badRequestResponse();
      }

      const environmentIdResult = await getEnvironmentIdFromResponseId(params.responseId);
      if (!environmentIdResult.ok) {
        return handleApiError(environmentIdResult.error);
      }

      const checkAuthorizationResult = await checkAuthorization({
        authentication,
        environmentId: environmentIdResult.data,
      });

      if (!checkAuthorizationResult.ok) {
        return handleApiError(checkAuthorizationResult.error);
      }

      const response = await updateResponse(params.responseId, body);

      if (!response.ok) {
        return handleApiError(response.error);
      }

      return responses.successResponse({ data: response.data });
    },
  });
