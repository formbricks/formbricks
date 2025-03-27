import { authenticatedApiClient } from "@/modules/api/v2/auth/authenticated-api-client";
import { responses } from "@/modules/api/v2/lib/response";
import { handleApiError } from "@/modules/api/v2/lib/utils";
import { getProjectTeams, createProjectTeam } from "./lib/projectTeams";
import { TProjectTeamInput, TGetProjectTeamsFilter, ZGetProjectTeamFilter, ZProjectTeamInput, projectTeamUpdateSchema } from "./types/projectTeams";
import { z } from "zod";
import { logger } from "@formbricks/logger";

export async function GET(request: Request) {
  return authenticatedApiClient({
    request,
    schemas: {
      query: ZGetProjectTeamFilter.sourceType(),
    },
    handler: async ({ parsedInput, authentication }) => {
        const { query } = parsedInput;

      if (!authentication.organizationId) {
        logger.error("Organization ID is missing from the authentication object");
        return handleApiError(request, { type: "unauthorized" });
      }

      if (!query) {
        return handleApiError(request, {
          type: "bad_request",
          details: [{ field: "query", issue: "missing" }],
        });
      }

      const result = await getProjectTeams(query);

      if (!result.ok) {
        return handleApiError(request, result.error);
      }

      return responses.successResponse(result);
    },
  });
}

export async function POST(request: Request) {
  return authenticatedApiClient({
    request,
    schemas: {
      body: ZProjectTeamInput,
    },
    handler: async ({ parsedInput, authentication }) => {
        const { body } = parsedInput;

      if (!authentication.organizationId) {
        logger.error("Organization ID is missing from the authentication object");

        return handleApiError(request, { type: "unauthorized" });
      }

      if (!body) {
        return handleApiError(request, {
          type: "bad_request",
          details: [{ field: "body", issue: "missing" }],
        });
      }



      const result = await createProjectTeam(body);
      if (!result.ok) {
        return handleApiError(request, result.error);
      }

      return responses.successResponse({ data: result.data, cors: true });
    },
  });
}

export async function PUT(request: Request) {
  return authenticatedApiClient({
    request,
    schemas: {
      body: projectTeamUpdateSchema,
    },
    handler: async ({ parsedInput, authentication }) => {
        const { body } = parsedInput;

        if (!authentication.organizationId) {
            logger.error("Organization ID is missing from the authentication object");
    
            return handleApiError(request, { type: "unauthorized" });
          }

        if (!body) {
            return handleApiError(request, {
              type: "bad_request",
              details: [{ field: "body", issue: "missing" }],
            });
        }

      const result = await updateProjectTeam(body);
      if (!result.ok) {
        return handleApiError(request, result.error);
      }

      return responses.successResponse({ data: result.data, cors: true });
    },
  });
}
