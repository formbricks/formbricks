import { authenticatedApiClient } from "@/modules/api/v2/auth/authenticated-api-client";
import { checkAuthorization } from "@/modules/api/v2/auth/check-authorization";
import { responses } from "@/modules/api/v2/lib/response";
import { handleApiError } from "@/modules/api/v2/lib/utils";
import { getEnvironmentId } from "@/modules/api/v2/management/lib/helper";
import { getOrganizationIdFromEnvironmentId } from "@/modules/api/v2/management/responses/lib/organization";
import { getTeams } from "@/modules/api/v2/organizations/[organizationId]/teams/lib/teams";
import {
  ZGetTeamsFilter,
  ZTeamInput,
} from "@/modules/api/v2/organizations/[organizationId]/teams/types/teams";
import { NextRequest } from "next/server";
import { createResponse, getResponses } from "./lib/response";

export const GET = async (request: NextRequest) =>
  authenticatedApiClient({
    request,
    schemas: {
      query: ZGetTeamsFilter.sourceType(),
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
      const organization = await getOrganizationIdFromEnvironmentId(environmentId);

      if (!organization.ok) {
        return handleApiError(request, organization.error);
      }

      const res = await getTeams(organization.data, query);

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
      body: ZTeamInput,
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

      const checkAuthorizationResult = await checkAuthorization({
        authentication,
        environmentId,
      });

      if (!checkAuthorizationResult.ok) {
        return handleApiError(request, checkAuthorizationResult.error);
      }

      const organization = await getOrganizationIdFromEnvironmentId(environmentId);

      if (!organization.ok) {
        return handleApiError(request, organization.error);
      }

      const createResponseResult = await createResponse(environmentId, body);
      if (!createResponseResult.ok) {
        return handleApiError(request, createResponseResult.error);
      }

      return responses.successResponse({ data: createResponseResult.data, cors: true });
    },
  });
