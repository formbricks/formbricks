import { authenticatedApiClient } from "@/modules/api/v2/auth/authenticated-api-client";
import { responses } from "@/modules/api/v2/lib/response";
import { handleApiError } from "@/modules/api/v2/lib/utils";
import { createTeam, getTeams } from "@/modules/api/v2/organizations/teams/lib/teams";
import { ZGetTeamsFilter, ZTeamInput } from "@/modules/api/v2/organizations/teams/types/teams";
import { NextRequest } from "next/server";
import { logger } from "@formbricks/logger";

export const GET = async (request: NextRequest) =>
  authenticatedApiClient({
    request,
    schemas: {
      query: ZGetTeamsFilter.sourceType(),
    },
    handler: async ({ authentication, parsedInput }) => {
      const { query } = parsedInput;

      if (!authentication.organizationId) {
        logger.error("Organization ID is missing from the authentication object");

        return handleApiError(request, {
          type: "unauthorized",
        });
      }

      if (!query) {
        return handleApiError(request, {
          type: "bad_request",
          details: [{ field: "query", issue: "missing" }],
        });
      }

      const res = await getTeams(authentication.organizationId, query);

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

      if (!authentication.organizationId) {
        logger.error("Organization ID is missing from the authentication object");

        return handleApiError(request, {
          type: "unauthorized",
        });
      }

      if (!body) {
        return handleApiError(request, {
          type: "bad_request",
          details: [{ field: "body", issue: "missing" }],
        });
      }

      const createTeamResult = await createTeam(body, authentication.organizationId);
      if (!createTeamResult.ok) {
        return handleApiError(request, createTeamResult.error);
      }

      return responses.successResponse({ data: createTeamResult.data, cors: true });
    },
  });
