import { responses } from "@/modules/api/lib/response";
import { handleApiError } from "@/modules/api/lib/utils";
import { authenticatedApiClient } from "@/modules/api/management/auth/authenticatedApiClient";
import { checkAuthorization } from "@/modules/api/management/auth/checkAuthorization";
import { getEnvironmentId } from "@/modules/api/management/lib/helper";
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
        return handleApiError(request, {
          type: "bad_request",
          details: [{ field: "query", issue: "missing" }],
        });
      }

      const environmentId = authentication.environmentId;

      const res = await getResponses(environmentId, query);

      if (res.ok) {
        return responses.successResponse(res.data);
      }

      return handleApiError(request, res.error);
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
        return handleApiError(request, {
          type: "bad_request",
          details: [{ field: "body", issue: "missing" }],
        });
      }

      console.log("body", body);

      const environmentIdResult = await getEnvironmentId(body.surveyId, false);

      console.log("environmentIdResult", environmentIdResult);

      if (!environmentIdResult.ok) {
        return handleApiError(request, environmentIdResult.error);
      }

      const environmentId = environmentIdResult.data;

      const checkAuthorizationResult = await checkAuthorization({
        authentication,
        environmentId,
      });

      if (!checkAuthorizationResult.ok) {
        return handleApiError(request, checkAuthorizationResult.error);
      }

      // if there is a createdAt but no updatedAt, set updatedAt to createdAt
      if (body.createdAt && !body.updatedAt) {
        body.updatedAt = body.createdAt;
      }

      const createResponseResult = await createResponse(environmentId, body);
      if (!createResponseResult.ok) {
        return handleApiError(request, createResponseResult.error);
      }

      return responses.successResponse({ data: createResponseResult.data, cors: true });
    },
  });
