import { responses } from "@/modules/api/lib/response";
import { handleApiError } from "@/modules/api/lib/utils";
import { authenticatedApiClient, checkAuthorization } from "@/modules/api/management/auth";
import { getEnvironmentIdFromSurveyId } from "@/modules/api/management/lib/helper";
import { ZGetResponsesFilter, ZResponseInput } from "@/modules/api/management/responses/types/responses";
import { NextRequest } from "next/server";
import { createResponse, getResponses } from "./lib/response";

export const GET = async (request: NextRequest) =>
  authenticatedApiClient({
    request,
    schemas: {
      query: ZGetResponsesFilter.sourceType(),
    },
    handler: async ({ authentication, parsedInput }) => {
      const { query } = parsedInput;

      if (!query) {
        return responses.badRequestResponse();
      }

      const environmentId = authentication.environmentId;

      const res = await getResponses(environmentId, query);

      if (res.ok) {
        return responses.successResponse(res.data);
      }

      return handleApiError(res.error);
    },
  });

export const POST = async (request: Request) =>
  authenticatedApiClient({
    request,
    schemas: {
      body: ZResponseInput,
    },
    handler: async ({ authentication, parsedInput }) => {
      const { body } = parsedInput;

      if (!body) {
        return responses.badRequestResponse();
      }

      const environmentIdResult = await getEnvironmentIdFromSurveyId(body.surveyId);
      if (!environmentIdResult.ok) {
        return handleApiError(environmentIdResult.error);
      }

      const environmentId = environmentIdResult.data;

      const checkAuthorizationResult = await checkAuthorization({
        authentication,
        environmentId,
      });

      if (!checkAuthorizationResult.ok) {
        return handleApiError(checkAuthorizationResult.error);
      }

      // if there is a createdAt but no updatedAt, set updatedAt to createdAt
      if (body.createdAt && !body.updatedAt) {
        body.updatedAt = body.createdAt;
      }

      const createResponseResult = await createResponse(environmentId, body);
      if (!createResponseResult.ok) {
        return handleApiError(createResponseResult.error);
      }

      return responses.successResponse({ data: createResponseResult.data, cors: true });
    },
  });
