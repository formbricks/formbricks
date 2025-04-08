import { authenticatedApiClient } from "@/modules/api/v2/auth/authenticated-api-client";
import { responses } from "@/modules/api/v2/lib/response";
import { handleApiError } from "@/modules/api/v2/lib/utils";
import { getEnvironmentId } from "@/modules/api/v2/management/lib/helper";
import { ZGetResponsesFilter, ZResponseInput } from "@/modules/api/v2/management/responses/types/responses";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";
import { Response } from "@prisma/client";
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

      const environmentIds = authentication.environmentPermissions.map(
        (permission) => permission.environmentId
      );

      const environmentResponses: Response[] = [];
      const res = await getResponses(environmentIds, query);

      if (!res.ok) {
        return handleApiError(request, res.error);
      }

      environmentResponses.push(...res.data.data);

      return responses.successResponse({ data: environmentResponses });
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

      const environmentIdResult = await getEnvironmentId(body.surveyId, false);

      if (!environmentIdResult.ok) {
        return handleApiError(request, environmentIdResult.error);
      }

      const environmentId = environmentIdResult.data;

      if (!hasPermission(authentication.environmentPermissions, environmentId, "POST")) {
        return handleApiError(request, {
          type: "unauthorized",
        });
      }

      // if there is a createdAt but no updatedAt, set updatedAt to createdAt
      if (body.createdAt && !body.updatedAt) {
        body.updatedAt = body.createdAt;
      }

      const createResponseResult = await createResponse(environmentId, body);
      if (!createResponseResult.ok) {
        return handleApiError(request, createResponseResult.error);
      }

      return responses.successResponse({ data: createResponseResult.data });
    },
  });
